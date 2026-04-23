import Foundation

/// Pure helper that slices a linear byte range into ordered,
/// contiguous chunks the RAW upload loop sends to Drive. Kept
/// separate from the coordinator so the math can be unit-tested
/// without a FileHandle or a mocked URLSession.
///
/// Contract:
///   * Chunks are sequential, non-overlapping, and cover the full
///     0..<totalBytes range.
///   * Every chunk except the last is exactly ``chunkSize`` long.
///     The last chunk shrinks to the remainder.
///   * Resuming from ``startingAtByte`` skips chunks that fall
///     entirely before it, and re-aligns the first served chunk's
///     start + length so the upload continues precisely where Drive
///     paused — no duplicate bytes, no gaps.
enum ChunkPlanner {

    struct Chunk: Equatable, Sendable {
        let startByte: Int64
        /// Number of bytes this chunk covers. ``startByte + length ==
        /// next chunk's startByte`` for every non-terminal chunk.
        let length: Int64
        var endByteInclusive: Int64 { startByte + length - 1 }
    }

    /// Plan all chunks for a file of ``totalBytes``. Returns an
    /// empty array for zero-byte files — Drive rejects zero-byte
    /// resumable uploads, but treating that as a degenerate
    /// precondition here lets the coordinator short-circuit without
    /// a special case for the sentinel.
    static func plan(
        totalBytes: Int64,
        chunkSize: Int64 = DriveRequestBuilder.preferredChunkBytes,
    ) -> [Chunk] {
        guard totalBytes > 0, chunkSize > 0 else { return [] }
        var chunks: [Chunk] = []
        var offset: Int64 = 0
        while offset < totalBytes {
            let remaining = totalBytes - offset
            let length = min(chunkSize, remaining)
            chunks.append(Chunk(startByte: offset, length: length))
            offset += length
        }
        return chunks
    }

    /// Plan the remaining chunks when resuming mid-upload.
    /// ``startingAtByte`` is the first byte that still needs to be
    /// sent (i.e. ``DriveChunkProgress.nextByteToSend``).
    ///
    /// Called after a crash recovery or a 308 status poll: we don't
    /// re-upload bytes Drive already has, but the chunk-aligned
    /// grid must continue on the same boundary the upload started
    /// on so Drive's reassembly buffer doesn't get confused.
    static func planResume(
        totalBytes: Int64,
        startingAtByte start: Int64,
        chunkSize: Int64 = DriveRequestBuilder.preferredChunkBytes,
    ) -> [Chunk] {
        guard totalBytes > 0, chunkSize > 0 else { return [] }
        let effectiveStart = max(0, start)
        guard effectiveStart < totalBytes else { return [] }
        var chunks: [Chunk] = []
        var offset = effectiveStart
        while offset < totalBytes {
            let remaining = totalBytes - offset
            let length = min(chunkSize, remaining)
            chunks.append(Chunk(startByte: offset, length: length))
            offset += length
        }
        return chunks
    }

    /// Total number of chunks for a file. Helper so the UI can
    /// render "chunk 3/12" without materialising the full plan.
    static func totalChunkCount(
        totalBytes: Int64,
        chunkSize: Int64 = DriveRequestBuilder.preferredChunkBytes,
    ) -> Int {
        guard totalBytes > 0, chunkSize > 0 else { return 0 }
        // Ceiling division, Int64-safe.
        return Int((totalBytes + chunkSize - 1) / chunkSize)
    }
}
