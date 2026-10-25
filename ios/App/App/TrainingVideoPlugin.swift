import Foundation
import Capacitor
import PhotosUI
import AVFoundation

final class TrainingBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(TrainingVideoPlugin())
    }
}

/// App-owned temporary video files only. No library-wide photo permission is requested.
@objc(TrainingVideoPlugin)
public final class TrainingVideoPlugin: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate {
    public let identifier = "TrainingVideoPlugin"
    public let jsName = "TrainingVideo"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "chooseVideo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepareVideo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelPreparation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "releaseVideo", returnType: CAPPluginReturnPromise)
    ]
    private var selection: CAPPluginCall?
    private var files: [String: URL] = [:]
    private var exporter: AVAssetExportSession?
    private var generation = 0

    public override func load() {
        let manager = FileManager.default
        let urls = (try? manager.contentsOfDirectory(at: manager.temporaryDirectory, includingPropertiesForKeys: [.contentModificationDateKey])) ?? []
        for url in urls where url.lastPathComponent.hasPrefix("pd-source-") || url.lastPathComponent.hasPrefix("pd-prepared-") {
            let modified = (try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            if modified < Date().addingTimeInterval(-86400) { try? manager.removeItem(at: url) }
        }
    }
    @objc func chooseVideo(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.selection == nil, self.exporter == nil else { call.reject("Finish or cancel the current video first."); return }
            self.selection = call
            var config = PHPickerConfiguration()
            config.filter = .videos
            config.selectionLimit = 1
            config.preferredAssetRepresentationMode = .current
            let picker = PHPickerViewController(configuration: config)
            picker.delegate = self
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }
    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let call = selection else { return }
        guard let result = results.first else { selection = nil; call.resolve(["canceled": true]); return }
        let request = generation
        result.itemProvider.loadFileRepresentation(forTypeIdentifier: "public.movie") { url, error in
            guard let url = url, error == nil else { DispatchQueue.main.async { self.selection = nil; if self.generation == request { call.reject("The video could not be read. Download it from iCloud Photos and try again.") } }; return }
            let id = UUID().uuidString
            let copy = FileManager.default.temporaryDirectory.appendingPathComponent("pd-source-\(id).mov")
            do {
                try FileManager.default.copyItem(at: url, to: copy)
                let asset = AVURLAsset(url: copy)
                let duration = CMTimeGetSeconds(asset.duration)
                guard duration.isFinite, duration > 0, !asset.tracks(withMediaType: .video).isEmpty else { try? FileManager.default.removeItem(at: copy); DispatchQueue.main.async { self.selection = nil; if self.generation == request { call.reject("Choose a playable video.") } }; return }
                DispatchQueue.main.async {
                    guard self.generation == request else { try? FileManager.default.removeItem(at: copy); return }
                    self.selection = nil
                    self.files[id] = copy
                    call.resolve(["id": id, "duration": duration, "canceled": false])
                }
            } catch { DispatchQueue.main.async { self.selection = nil; if self.generation == request { call.reject("There is not enough temporary storage to prepare this video.") } } }
        }
    }
    @objc func prepareVideo(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let id = call.getString("id"), let source = self.files[id], self.exporter == nil else { call.reject("Choose the video again before preparing it."); return }
            let start = call.getDouble("start") ?? 0
            let end = call.getDouble("end") ?? 0
            let maxBytes = min(call.getInt("maxBytes") ?? 12582912, 41943040)
            let outputID = UUID().uuidString
            let output = FileManager.default.temporaryDirectory.appendingPathComponent("pd-prepared-\(outputID).mp4")
            let export: AVAssetExportSession
            do { export = try TrainingVideoExporter.session(source: source, output: output, start: start, end: end, maxBytes: maxBytes) }
            catch { call.reject("Choose a playable clip up to 3 minutes within the selected video."); return }
            self.exporter = export
            let timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { _ in
                self.notifyListeners("preparationProgress", data: ["progress": Double(export.progress)])
            }
            export.exportAsynchronously {
                DispatchQueue.main.async {
                    timer.invalidate()
                    self.exporter = nil
                    guard export.status == .completed else {
                        try? FileManager.default.removeItem(at: output)
                        if export.status == .cancelled { call.resolve(["canceled": true]); return }
                        call.reject("Preparation failed. Shorten the clip or choose another video."); return
                    }
                    let bytes = (try? output.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
                    guard bytes > 0, bytes <= maxBytes else { try? FileManager.default.removeItem(at: output); call.reject("The prepared file is still too large. Choose a shorter clip."); return }
                    self.files[outputID] = output
                    call.resolve(["id": outputID, "fileURL": output.absoluteString, "size": bytes, "duration": end - start, "canceled": false])
                }
            }
        }
    }
    @objc func cancelPreparation(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.generation += 1
            self.exporter?.cancelExport()
            self.selection?.resolve(["canceled": true])
            self.selection = nil
            if self.bridge?.viewController?.presentedViewController is PHPickerViewController { self.bridge?.viewController?.dismiss(animated: true) }
            call.resolve()
        }
    }
    @objc func releaseVideo(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let id = call.getString("id"), let url = self.files.removeValue(forKey: id) { try? FileManager.default.removeItem(at: url) }
            call.resolve()
        }
    }
}

// Kept separate so native tests can exercise the same range validation as exports.
enum TrainingVideoExporter {
    static func session(source: URL, output: URL, start: Double, end: Double, maxBytes: Int) throws -> AVAssetExportSession {
        let asset = AVURLAsset(url: source)
        guard validRange(duration: CMTimeGetSeconds(asset.duration), start: start, end: end, maximum: 180), maxBytes > 0, maxBytes <= 41943040,
              !asset.tracks(withMediaType: .video).isEmpty,
              let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetMediumQuality), export.supportedFileTypes.contains(.mp4) else {
            throw NSError(domain: "PlayerDevelopmentVideo", code: 1, userInfo: [NSLocalizedDescriptionKey: "Choose a playable video and a valid clip up to 180 seconds."])
        }
        export.outputURL = output
        export.outputFileType = .mp4
        export.shouldOptimizeForNetworkUse = true
        export.metadata = [] // Do not carry recording-location metadata into a training upload.
        export.fileLengthLimit = Int64(maxBytes)
        export.timeRange = CMTimeRange(start: CMTime(seconds: start, preferredTimescale: 600), duration: CMTime(seconds: end-start, preferredTimescale: 600))
        return export
    }
    static func validRange(duration: Double, start: Double, end: Double, maximum: Double) -> Bool {
        duration.isFinite && start.isFinite && end.isFinite && start >= 0 && end > start && end <= duration + 0.05 && end - start <= maximum
    }
}
