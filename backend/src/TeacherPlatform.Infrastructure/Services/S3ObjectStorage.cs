using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Options;

namespace TeacherPlatform.Infrastructure.Services;

/// <summary>S3-compatible private object storage. Credentials are supplied by configuration only.</summary>
public sealed class S3ObjectStorage : IObjectStorage
{
    private readonly IAmazonS3 _client;
    private readonly string _bucket;

    public S3ObjectStorage(IAmazonS3 client, StorageOptions options)
    {
        _client = client;
        _bucket = options.Bucket
            ?? throw new InvalidOperationException("Storage:Bucket is required for S3.");
    }

    public async Task UploadAsync(
        string objectKey,
        Stream content,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        ValidateObjectKey(objectKey);
        var request = new PutObjectRequest
        {
            BucketName = _bucket,
            Key = objectKey,
            InputStream = content,
            ContentType = contentType,
            AutoCloseStream = false,
            DisablePayloadSigning = false
        };
        await _client.PutObjectAsync(request, cancellationToken);
    }

    public async Task<Stream> OpenReadAsync(
        string objectKey,
        CancellationToken cancellationToken = default)
    {
        ValidateObjectKey(objectKey);
        try
        {
            var response = await _client.GetObjectAsync(_bucket, objectKey, cancellationToken);
            return new OwnedResponseStream(response);
        }
        catch (AmazonS3Exception exception) when (exception.StatusCode == HttpStatusCode.NotFound)
        {
            throw new FileNotFoundException("Object was not found.", objectKey, exception);
        }
    }

    public async Task DeleteAsync(
        string objectKey,
        CancellationToken cancellationToken = default)
    {
        ValidateObjectKey(objectKey);
        await _client.DeleteObjectAsync(_bucket, objectKey, cancellationToken);
    }

    public async Task<bool> ExistsAsync(
        string objectKey,
        CancellationToken cancellationToken = default)
    {
        ValidateObjectKey(objectKey);
        try
        {
            await _client.GetObjectMetadataAsync(_bucket, objectKey, cancellationToken);
            return true;
        }
        catch (AmazonS3Exception exception) when (exception.StatusCode == HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    private static void ValidateObjectKey(string objectKey)
    {
        if (string.IsNullOrWhiteSpace(objectKey) || objectKey.StartsWith('/') || objectKey.Contains("..", StringComparison.Ordinal))
        {
            throw new ArgumentException("Object key is invalid.", nameof(objectKey));
        }
    }

    private sealed class OwnedResponseStream : Stream
    {
        private readonly GetObjectResponse _response;
        private readonly Stream _inner;

        public OwnedResponseStream(GetObjectResponse response)
        {
            _response = response;
            _inner = response.ResponseStream;
        }

        public override bool CanRead => _inner.CanRead;
        public override bool CanSeek => _inner.CanSeek;
        public override bool CanWrite => false;
        public override long Length => _inner.Length;
        public override long Position { get => _inner.Position; set => _inner.Position = value; }
        public override void Flush() => _inner.Flush();
        public override int Read(byte[] buffer, int offset, int count) => _inner.Read(buffer, offset, count);
        public override long Seek(long offset, SeekOrigin origin) => _inner.Seek(offset, origin);
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override Task FlushAsync(CancellationToken cancellationToken) => _inner.FlushAsync(cancellationToken);
        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
            _inner.ReadAsync(buffer, offset, count, cancellationToken);
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default) =>
            _inner.ReadAsync(buffer, cancellationToken);

        protected override void Dispose(bool disposing)
        {
            if (disposing) _response.Dispose();
            base.Dispose(disposing);
        }

        public override ValueTask DisposeAsync()
        {
            _response.Dispose();
            GC.SuppressFinalize(this);
            return ValueTask.CompletedTask;
        }
    }
}
