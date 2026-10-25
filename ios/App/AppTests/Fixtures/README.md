# Original native conversion fixture

`fictional-hevc.mov` is an original one-second, 64×64 black-frame video generated for automated testing. It contains no people, audio or coaching demonstration. It verifies the system's HEVC MOV → H.264 MP4 conversion path.

Generation: FFmpeg color source, 15 fps, libx265, `hvc1` tag, `yuv420p`. No FFmpeg encoder library is bundled in the app; production conversion uses Apple's AVFoundation.
