using Microsoft.AspNetCore.Mvc;

namespace CameraApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class VideoController : ControllerBase
    {
        private readonly string _uploadPath;
        // Danh sách đuôi file cho phép
        private readonly string[] _allowedExtensions = [".jpg", ".jpeg", ".png", ".webm", ".mp4"];

        public VideoController(IWebHostEnvironment env)
        {
            _uploadPath = Path.Combine(env.WebRootPath, "uploads");
            if (!Directory.Exists(_uploadPath)) Directory.CreateDirectory(_uploadPath);
        }

        // API này sẽ được gọi liên tục mỗi vài giây khi đang quay video
        [HttpPost("append/{fileName}")]
        public async Task<IActionResult> AppendChunk(string fileName, [FromForm] IFormFile chunk)
        {
            if (chunk == null || chunk.Length == 0)
                return BadRequest("Empty chunk");

            // 1. Sanitize (Bảo mật tên file)
            var safeFileName = Path.GetFileName(fileName);
            var ext = Path.GetExtension(safeFileName).ToLowerInvariant();

            if (!_allowedExtensions.Contains(ext))
                return BadRequest("Invalid extension");

            var filePath = Path.Combine(_uploadPath, safeFileName);

            try
            {
                // Dùng FileShare.Write để tránh lock nếu request đến quá dồn dập
                // FileMode.Append: Tự tạo mới nếu chưa có, nối đuôi nếu đã có
                using (var stream = new FileStream(filePath, FileMode.Append, FileAccess.Write, FileShare.None))
                {
                    await chunk.CopyToAsync(stream);
                }
                return Ok(new { size = chunk.Length });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Write error: {ex.Message}");
            }
        }
    }
}