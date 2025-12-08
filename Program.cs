using CameraApp.Components;
using Xabe.FFmpeg.Downloader;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddHubOptions(options =>
    {
        // Tăng giới hạn lên 100MB (tùy nhu cầu của bạn)
        options.MaximumReceiveMessageSize = 100 * 1024 * 1024;
    });

string ffmpegPath = Path.Combine(Directory.GetCurrentDirectory(), "ffmpeg");
if (!Directory.Exists(ffmpegPath))
{
    Directory.CreateDirectory(ffmpegPath);
    Console.WriteLine("Đang tải FFmpeg (chỉ lần đầu)... vui lòng chờ.");
    // Tùy chọn phiên bản phù hợp OS (Linux/Windows/MacOS)
    await FFmpegDownloader.GetLatestVersion(FFmpegVersion.Official, ffmpegPath);
    Console.WriteLine("Đã tải xong FFmpeg.");
}
// Chỉ định đường dẫn chứa file chạy FFmpeg cho thư viện
Xabe.FFmpeg.FFmpeg.SetExecutablesPath(ffmpegPath);

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}
app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
app.UseHttpsRedirection();

app.UseAntiforgery();

app.MapStaticAssets();

app.MapControllers();

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
