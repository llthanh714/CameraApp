using Microsoft.AspNetCore.Mvc;

namespace CameraApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class VideoController : ControllerBase
    {
        private readonly string _uploadPath;
        // Danh sách đuôi file cho phép
        private readonly string[] _allowedExtensions = { ".jpg", ".jpeg", ".png", ".webm", ".mp4" };

        public VideoController(IWebHostEnvironment env)
        {
            _uploadPath = Path.Combine(env.WebRootPath, "uploads");
            if (!Directory.Exists(_uploadPath)) Directory.CreateDirectory(_uploadPath);
        }

        [HttpPost("append/{fileName}")]
        public async Task<IActionResult> AppendChunk(string fileName, [FromForm] IFormFile chunk)
        {
            if (chunk == null || chunk.Length == 0)
                return BadRequest("Không có dữ liệu gửi lên.");

            // 1. Sanitize FileName (Chống Path Traversal)
            // Chỉ lấy tên file, loại bỏ mọi ký tự đường dẫn như ".." hay "/"
            var safeFileName = Path.GetFileName(fileName);

            // 2. Validate Extension (Bảo mật)
            var ext = Path.GetExtension(safeFileName).ToLowerInvariant();
            if (!_allowedExtensions.Contains(ext))
            {
                return BadRequest($"Định dạng file không hỗ trợ: {ext}");
            }

            var filePath = Path.Combine(_uploadPath, safeFileName);

            try 
            {
                // Mở file với chế độ Append (Nối thêm vào cuối file)
                using (var stream = new FileStream(filePath, FileMode.Append))
                {
                    await chunk.CopyToAsync(stream);
                }
                return Ok();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi server: {ex.Message}");
            }
        }
    }
}