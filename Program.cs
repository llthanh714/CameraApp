using CameraApp.Components;
using CameraApp.Services;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using System.Security.Cryptography.X509Certificates;
using Xabe.FFmpeg.Downloader;


var kestrelCertPassword = Environment.GetEnvironmentVariable("__KESTREL_CERT_PASSWORD__", EnvironmentVariableTarget.Machine);

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

// Đăng ký HIS Service
builder.Services.AddSingleton<HisService>();

builder.WebHost.ConfigureKestrel(serverOptions =>
{
    var certConfig = builder.Configuration.GetSection("Kestrel:Certificate");
    var certPath = certConfig["Path"];

    if (string.IsNullOrEmpty(certPath) || string.IsNullOrEmpty(kestrelCertPassword))
    {
        Console.WriteLine("Kestrel certificate path or password is not configured. HTTPS will not be available.");
        return;
    }

    serverOptions.ConfigureHttpsDefaults(https =>
    {
        https.ServerCertificate = X509CertificateLoader.LoadPkcs12FromFile(certPath, kestrelCertPassword);
    });

    serverOptions.ListenAnyIP(7274, listenOptions =>
    {
        listenOptions.Protocols = HttpProtocols.Http1AndHttp2AndHttp3;
        listenOptions.UseHttps();
    });
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

// app.UsePathBase("/capture");

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

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
