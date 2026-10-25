import XCTest
import AVFoundation
import CoreVideo
import Darwin
@testable import App

final class TrainingVideoTests: XCTestCase {
    func testClipValidationRejectsInvalidOrExcessiveRanges() throws {
        let privacyURL = try XCTUnwrap(Bundle.main.url(forResource: "PrivacyInfo", withExtension: "xcprivacy"))
        let privacy = try PropertyListSerialization.propertyList(from: Data(contentsOf: privacyURL), options: [], format: nil) as! [String: Any]
        let accessed = try XCTUnwrap(privacy["NSPrivacyAccessedAPITypes"] as? [[String: Any]])
        XCTAssertTrue(accessed.contains { entry in
            entry["NSPrivacyAccessedAPIType"] as? String == "NSPrivacyAccessedAPICategoryFileTimestamp" && (entry["NSPrivacyAccessedAPITypeReasons"] as? [String])?.contains("C617.1") == true
        })

        XCTAssertTrue(TrainingVideoExporter.validRange(duration: 20, start: 2, end: 12, maximum: 180))
        for values in [(-1.0, 1.0), (2.0, 2.0), (0.0, 21.0), (Double.nan, 3.0), (0.0, Double.infinity)] {
            XCTAssertFalse(TrainingVideoExporter.validRange(duration: 20, start: values.0, end: values.1, maximum: 180))
        }
        XCTAssertFalse(TrainingVideoExporter.validRange(duration: 600, start: 0, end: 181, maximum: 180))
    }
    func testOriginalMOVIsTrimmedAndExportedAsSmallH264MP4() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let input = folder.appendingPathComponent("original-fictional.mov")
        let output = folder.appendingPathComponent("prepared.mp4")
        let writer = try AVAssetWriter(outputURL: input, fileType: .mov)
        let frames = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: 64, AVVideoHeightKey: 64])
        frames.expectsMediaDataInRealTime = false
        let pixels = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: frames, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: 64, kCVPixelBufferHeightKey as String: 64])
        writer.add(frames)
        XCTAssertTrue(writer.startWriting())
        writer.startSession(atSourceTime: .zero)
        for n in 0..<30 {
            let deadline = Date().addingTimeInterval(5)
            while !frames.isReadyForMoreMediaData && deadline.timeIntervalSinceNow > 0 { RunLoop.current.run(until: Date().addingTimeInterval(0.01)) }
            XCTAssertTrue(frames.isReadyForMoreMediaData)
            var pixel: CVPixelBuffer?
            XCTAssertEqual(CVPixelBufferCreate(kCFAllocatorDefault, 64, 64, kCVPixelFormatType_32ARGB, nil, &pixel), kCVReturnSuccess)
            let buffer = try XCTUnwrap(pixel)
            CVPixelBufferLockBaseAddress(buffer, [])
            let address = try XCTUnwrap(CVPixelBufferGetBaseAddress(buffer))
            memset(address, 0, CVPixelBufferGetDataSize(buffer))
            CVPixelBufferUnlockBaseAddress(buffer, [])
            XCTAssertTrue(pixels.append(buffer, withPresentationTime: CMTime(value: Int64(n), timescale: 15)))
        }
        frames.markAsFinished()
        let written = expectation(description: "Original fictional MOV encoded")
        writer.finishWriting { written.fulfill() }
        wait(for: [written], timeout: 20)
        XCTAssertEqual(writer.status, .completed)
        let export = try TrainingVideoExporter.session(source: input, output: output, start: 0.2, end: 1.2, maxBytes: 2_000_000)
        let finished = expectation(description: "Prepared MP4 exported")
        export.exportAsynchronously { finished.fulfill() }
        wait(for: [finished], timeout: 30)
        XCTAssertEqual(export.status, .completed, "\(String(describing: export.error))")
        let asset = AVURLAsset(url: output)
        XCTAssertEqual(CMTimeGetSeconds(asset.duration), 1, accuracy: 0.15)
        let track = try XCTUnwrap(asset.tracks(withMediaType: .video).first)
        let format = try XCTUnwrap(track.formatDescriptions.first) as! CMFormatDescription
        XCTAssertEqual(CMFormatDescriptionGetMediaSubType(format), kCMVideoCodecType_H264)
        let size = try output.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        XCTAssertGreaterThan(size, 0)
        XCTAssertLessThanOrEqual(size, 2_000_000)
        XCTAssertTrue(FileManager.default.fileExists(atPath: input.path), "The original must remain untouched")
        XCTAssertThrowsError(try TrainingVideoExporter.session(source: input, output: folder.appendingPathComponent("bad.mp4"), start: 1, end: 1, maxBytes: 2_000_000))
        XCTAssertThrowsError(try TrainingVideoExporter.session(source: input, output: folder.appendingPathComponent("large.mp4"), start: 0, end: 1, maxBytes: 50_000_000))
    }
    func testHEVCMOVIsConvertedToH264ForUpload() throws {
        let input = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "fictional-hevc", withExtension: "mov"))
        let output = FileManager.default.temporaryDirectory.appendingPathComponent("test-\(UUID().uuidString).mp4")
        defer { try? FileManager.default.removeItem(at: output) }
        let export = try TrainingVideoExporter.session(source: input, output: output, start: 0, end: 0.5, maxBytes: 1_000_000)
        let done = expectation(description: "HEVC converted to H264")
        export.exportAsynchronously { done.fulfill() }
        wait(for: [done], timeout: 30)
        XCTAssertEqual(export.status, .completed, "\(String(describing: export.error))")
        let asset = AVURLAsset(url: output)
        let track = try XCTUnwrap(asset.tracks(withMediaType: .video).first)
        let format = try XCTUnwrap(track.formatDescriptions.first) as! CMFormatDescription
        XCTAssertEqual(CMFormatDescriptionGetMediaSubType(format), kCMVideoCodecType_H264)
        XCTAssertEqual(CMTimeGetSeconds(asset.duration), 0.5, accuracy: 0.15)
    }

}
