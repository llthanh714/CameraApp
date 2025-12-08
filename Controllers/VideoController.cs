using Microsoft.AspNetCore.Mvc;

namespace CameraApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class VideoController : ControllerBase
    {
        private readonly string _uploadPath;

        public VideoController(IWebHostEnvironment env)
        {
            _uploadPath = Path.Combine(env.WebRootPath, "uploads");
            if (!Directory.Exists(_uploadPath)) Directory.CreateDirectory(_uploadPath);
        }

        [HttpPost("append/{fileName}")]
        public async Task<IActionResult> AppendChunk(string fileName, [FromForm] IFormFile chunk)
        {
            if (chunk == null || chunk.Length == 0)
                return BadRequest("Không có dữ liệu");

            var filePath = Path.Combine(_uploadPath, fileName);

            // Mở file với chế độ Append (Nối thêm vào cuối file)
            // Nếu file chưa có -> Tạo mới. Nếu có rồi -> Ghi tiếp vào đuôi.
            using (var stream = new FileStream(filePath, FileMode.Append))
            {
                await chunk.CopyToAsync(stream);
            }

            return Ok();
        }
    }
}