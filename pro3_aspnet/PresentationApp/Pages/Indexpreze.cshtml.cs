using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Text.Json;
using System.IO;
using System.Collections.Generic;

namespace PresentationApp.Pages;

public class PresentationData
{
    public string Title { get; set; } = "Мэргэжлийн Прези Танилцуулга";
    public string Theme { get; set; } = "cosmic"; // "cosmic", "slate", "light", "emerald", "cyber"
    public string BackgroundType { get; set; } = "gradient";
    public string BackgroundColor { get; set; } = "#0f172a";
    public string? BackgroundImage { get; set; }
    public List<PreziSlideData> Slides { get; set; } = new();
}

public class PreziSlideData
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "Слайд";
    public double X { get; set; }
    public double Y { get; set; }
    public double Z { get; set; }
    public double Rotate { get; set; } = 0; // Rotation angle in degrees
    public double Scale { get; set; } = 1.0;
    public string Shape { get; set; } = "rounded"; // "rounded", "circle", "bracket", "invisible"
    public string BgColor { get; set; } = "#1e293b";
    public double BgOpacity { get; set; } = 0.85;
    public string BorderColor { get; set; } = "rgba(255, 255, 255, 0.15)";
    public string AccentColor { get; set; } = "#3b82f6";
    public List<SlideElement> Elements { get; set; } = new();
}

public class SlideElement
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = "text"; // "text", "image", "shape", "badge", "card"
    public string Content { get; set; } = "";
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; } = 300;
    public double Height { get; set; } = 100;
    public double Rotate { get; set; } = 0;
    public string Style { get; set; } = "";
}

[IgnoreAntiforgeryToken(Order = 1001)]
public class IndexprezeModel : PageModel
{
    private readonly IWebHostEnvironment _env;

    public IndexprezeModel(IWebHostEnvironment env)
    {
        _env = env;
    }

    public string BackgroundColor { get; set; } = "#0b1120";
    public string? BackgroundImage { get; set; }
    
    // Main presentation data
    public PresentationData Presentation { get; set; } = new PresentationData();

    public void OnGet()
    {
        if (HttpContext.Session.TryGetValue("PresentationBackgroundColor", out var colorBytes))
        {
            BackgroundColor = System.Text.Encoding.UTF8.GetString(colorBytes);
        }

        if (HttpContext.Session.TryGetValue("PresentationBackgroundImage", out var imgBytes))
        {
            BackgroundImage = System.Text.Encoding.UTF8.GetString(imgBytes);
        }

        var dataFolder = Path.Combine(_env.WebRootPath, "data");
        var configFile = Path.Combine(dataFolder, "presentation_content.json");
        
        if (System.IO.File.Exists(configFile))
        {
            try
            {
                using var stream = new FileStream(configFile, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                using var reader = new StreamReader(stream);
                var json = reader.ReadToEnd();
                Presentation = JsonSerializer.Deserialize<PresentationData>(json, new JsonSerializerOptions 
                { 
                    PropertyNameCaseInsensitive = true 
                }) ?? new PresentationData();

                // Fill any missing defaults for backward compatibility
                if (Presentation.Slides.Count == 0)
                {
                    Presentation = CreateDefaultPresentation();
                }
                else
                {
                    // Ensure each slide has a title and valid shape
                    for (int i = 0; i < Presentation.Slides.Count; i++)
                    {
                        var s = Presentation.Slides[i];
                        if (string.IsNullOrWhiteSpace(s.Title))
                        {
                            s.Title = s.Id == "overview" ? "Бүх сэдвийн тойм (Overview)" : $"Сэдэв {i}";
                        }
                        if (string.IsNullOrWhiteSpace(s.Shape))
                        {
                            s.Shape = "rounded";
                        }
                    }
                }
            }
            catch
            {
                Presentation = CreateDefaultPresentation();
            }
        }
        else
        {
            Presentation = CreateDefaultPresentation();
        }

        if (!string.IsNullOrEmpty(Presentation.BackgroundColor))
        {
            BackgroundColor = Presentation.BackgroundColor;
        }
    }

    public async Task<IActionResult> OnPostSavePresentationAsync([FromBody] PresentationData presentationData)
    {
        if (presentationData == null) return BadRequest();

        var dataFolder = Path.Combine(_env.WebRootPath, "data");
        Directory.CreateDirectory(dataFolder);
        var configFile = Path.Combine(dataFolder, "presentation_content.json");

        var newJson = JsonSerializer.Serialize(presentationData, new JsonSerializerOptions 
        { 
            WriteIndented = true,
            PropertyNamingPolicy = null
        });
        
        using (var stream = new FileStream(configFile, FileMode.Create, FileAccess.Write, FileShare.ReadWrite))
        using (var writer = new StreamWriter(stream))
        {
            await writer.WriteAsync(newJson);
        }

        return new JsonResult(new { success = true, timestamp = DateTime.Now.ToString("HH:mm:ss") });
    }

    public async Task<IActionResult> OnPostUploadImageAsync(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return new JsonResult(new { success = false, message = "Файл сонгогдоогүй байна." });
        }

        try
        {
            var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads");
            Directory.CreateDirectory(uploadsFolder);

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg" };
            if (!Array.Exists(allowedExtensions, e => e == ext))
            {
                return new JsonResult(new { success = false, message = "Зөвхөн зураг (PNG, JPG, WEBP, SVG) файл хуулна уу." });
            }

            var uniqueName = $"{Guid.NewGuid():N}_{Path.GetFileNameWithoutExtension(file.FileName)}{ext}";
            var destinationPath = Path.Combine(uploadsFolder, uniqueName);

            using (var stream = new FileStream(destinationPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var url = $"/uploads/{uniqueName}";
            return new JsonResult(new { success = true, url = url, fileName = file.FileName });
        }
        catch (Exception ex)
        {
            return new JsonResult(new { success = false, message = ex.Message });
        }
    }

    public IActionResult OnPostResetTemplate()
    {
        Presentation = CreateDefaultPresentation();
        var dataFolder = Path.Combine(_env.WebRootPath, "data");
        Directory.CreateDirectory(dataFolder);
        var configFile = Path.Combine(dataFolder, "presentation_content.json");

        var newJson = JsonSerializer.Serialize(Presentation, new JsonSerializerOptions 
        { 
            WriteIndented = true,
            PropertyNamingPolicy = null
        });
        System.IO.File.WriteAllText(configFile, newJson);

        return new JsonResult(new { success = true });
    }

    private PresentationData CreateDefaultPresentation()
    {
        var data = new PresentationData
        {
            Title = "Мэргэжлийн Бизнес Стратеги & Шилжилт",
            Theme = "cosmic",
            BackgroundColor = "#0a0f1d",
            Slides = new List<PreziSlideData>()
        };

        // 0. Overview Mindmap
        data.Slides.Add(new PreziSlideData
        {
            Id = "overview",
            Title = "Бүх сэдвийн тойм (Spatial Canvas)",
            X = 0,
            Y = 0,
            Z = 0,
            Rotate = 0,
            Scale = 3.8,
            Shape = "invisible",
            BgColor = "transparent",
            BgOpacity = 0,
            Elements = new List<SlideElement>()
        });

        // 1. Hero / Title Slide
        data.Slides.Add(new PreziSlideData
        {
            Id = "slide-1",
            Title = "Танилцуулга",
            X = -1800,
            Y = -400,
            Z = 0,
            Rotate = -8,
            Scale = 1.0,
            Shape = "rounded",
            BgColor = "#131b2e",
            BgOpacity = 0.9,
            BorderColor = "rgba(59, 130, 246, 0.4)",
            AccentColor = "#3b82f6",
            Elements = new List<SlideElement>
            {
                new SlideElement
                {
                    Id = "el-title-badge",
                    Type = "badge",
                    Content = "<span class=\"badge-pill\">🚀 Ирээдүйн инноваци 2026</span>",
                    X = 60,
                    Y = 60,
                    Width = 300,
                    Height = 40
                },
                new SlideElement
                {
                    Id = "el-hero-title",
                    Type = "text",
                    Content = "<h1 class=\"hero-title-text\">Дижитал Шилжилт &<br/><span class=\"text-gradient\">Бизнес Хөгжлийн Стратеги</span></h1>",
                    X = 60,
                    Y = 120,
                    Width = 840,
                    Height = 220
                },
                new SlideElement
                {
                    Id = "el-hero-sub",
                    Type = "text",
                    Content = "<p class=\"hero-subtitle-text\">Орчин үеийн 3D Prezi технологиор бүтээсэн интерактив, мэргэжлийн танилцуулга. Агуулгаа хялбар удирдаж, өндөр сэтгэгдэл төрүүлээрэй.</p>",
                    X = 60,
                    Y = 360,
                    Width = 820,
                    Height = 90
                },
                new SlideElement
                {
                    Id = "el-author-info",
                    Type = "card",
                    Content = "<div class=\"author-chip\"><div class=\"chip-avatar\">👤</div><div><strong>Төслийн Баг</strong><div style=\"font-size:12px; opacity:0.7;\">Стратеги & Дизайн хэлтэс</div></div></div>",
                    X = 60,
                    Y = 560,
                    Width = 320,
                    Height = 70
                }
            }
        });

        // 2. 3-Card KPI / Goals (Circle shape Prezi style)
        data.Slides.Add(new PreziSlideData
        {
            Id = "slide-2",
            Title = "Гол Зорилтууд (3 Багана)",
            X = -200,
            Y = 650,
            Z = 0,
            Rotate = 12,
            Scale = 1.1,
            Shape = "circle",
            BgColor = "#0f172a",
            BgOpacity = 0.92,
            BorderColor = "rgba(16, 185, 129, 0.4)",
            AccentColor = "#10b981",
            Elements = new List<SlideElement>
            {
                new SlideElement
                {
                    Id = "el-s2-title",
                    Type = "text",
                    Content = "<h2 style=\"text-align:center;\">Гол Зорилт & <span style=\"color:#10b981;\">KPI Үзүүлэлт</span></h2><p style=\"text-align:center; opacity:0.8;\">Хэмжигдэхүйц, өндөр үр дүнтэй өсөлтийн чиглэлүүд</p>",
                    X = 130,
                    Y = 70,
                    Width = 700,
                    Height = 90
                },
                new SlideElement
                {
                    Id = "el-s2-cards",
                    Type = "card",
                    Content = @"<div class=""three-cards-grid"">
                        <div class=""feature-card"">
                            <div class=""card-icon"">⚡</div>
                            <h3>+250%</h3>
                            <h4>Хурд & Бүтээмж</h4>
                            <p>Ажлын урсгалыг автоматжуулж цаг хугацааг 2 дахин хэмнэнэ.</p>
                        </div>
                        <div class=""feature-card highlight"">
                            <div class=""card-icon"">🎯</div>
                            <h3>99.4%</h3>
                            <h4>Сэтгэл Ханамж</h4>
                            <p>Хэрэглэгчдийн үнэлгээ болон найдвартай ажиллагааны түвшин.</p>
                        </div>
                        <div class=""feature-card"">
                            <div class=""card-icon"">🛡️</div>
                            <h3>ISO 27001</h3>
                            <h4>Аюулгүй Байдал</h4>
                            <p>Олон улсын стандартад бүрэн нийцсэн өгөгдлийн хамгаалалт.</p>
                        </div>
                    </div>",
                    X = 60,
                    Y = 190,
                    Width = 840,
                    Height = 440
                }
            }
        });

        // 3. Process Steps / Roadmap
        data.Slides.Add(new PreziSlideData
        {
            Id = "slide-3",
            Title = "Хөгжлийн 4 Үе Шат",
            X = 1600,
            Y = 200,
            Z = 0,
            Rotate = -6,
            Scale = 1.0,
            Shape = "rounded",
            BgColor = "#111827",
            BgOpacity = 0.9,
            BorderColor = "rgba(139, 92, 246, 0.4)",
            AccentColor = "#8b5cf6",
            Elements = new List<SlideElement>
            {
                new SlideElement
                {
                    Id = "el-s3-title",
                    Type = "text",
                    Content = "<h2>Хэрэгжүүлэх <span style=\"color:#a855f7;\">Замын Зураглал</span></h2><p style=\"opacity:0.8;\">Үе шат бүрийн дараалал ба нарийвчилсан төлөвлөгөө</p>",
                    X = 60,
                    Y = 50,
                    Width = 840,
                    Height = 80
                },
                new SlideElement
                {
                    Id = "el-s3-timeline",
                    Type = "card",
                    Content = @"<div class=""timeline-row"">
                        <div class=""timeline-step"">
                            <div class=""step-badge"">01</div>
                            <h4>Судалгаа</h4>
                            <p>Зах зээл, өрсөлдөгч болон хэрэгцээг нарийвчлан тодорхойлох.</p>
                        </div>
                        <div class=""timeline-arrow"">➔</div>
                        <div class=""timeline-step"">
                            <div class=""step-badge"">02</div>
                            <h4>Дизайн</h4>
                            <p>Prezi шиг 3D орон зайн архитектур, UI/UX шийдэл.</p>
                        </div>
                        <div class=""timeline-arrow"">➔</div>
                        <div class=""timeline-step"">
                            <div class=""step-badge"">03</div>
                            <h4>Хөгжүүлэлт</h4>
                            <p>Өндөр хурдтай технологи, агуулга хялбар оруулах горим.</p>
                        </div>
                        <div class=""timeline-arrow"">➔</div>
                        <div class=""timeline-step active"">
                            <div class=""step-badge"">04</div>
                            <h4>Нээлт</h4>
                            <p>Бүх платформ дээр амжилттай нэвтрүүлж зах зээлд гаргах.</p>
                        </div>
                    </div>",
                    X = 50,
                    Y = 170,
                    Width = 860,
                    Height = 460
                }
            }
        });

        // 4. Quote & Conclusion
        data.Slides.Add(new PreziSlideData
        {
            Id = "slide-4",
            Title = "Ишлэл & Дүгнэлт",
            X = 600,
            Y = -1200,
            Z = 0,
            Rotate = 15,
            Scale = 1.0,
            Shape = "bracket",
            BgColor = "#1e1b4b",
            BgOpacity = 0.92,
            BorderColor = "rgba(236, 72, 153, 0.5)",
            AccentColor = "#ec4899",
            Elements = new List<SlideElement>
            {
                new SlideElement
                {
                    Id = "el-s4-quote",
                    Type = "card",
                    Content = @"<div class=""quote-container"">
                        <div class=""quote-mark"">“</div>
                        <blockquote class=""quote-text"">
                            Агуу бүтээлийг бий болгох цорын ганц арга бол хийж буй ажилдаа чин сэтгэлээсээ дурлах явдал юм.
                        </blockquote>
                        <div class=""quote-author"">— Стив Жобс</div>
                        <div style=""margin-top: 30px; display:flex; gap:15px; justify-content:center;"">
                            <span class=""pill-tag"">🌟 Шинэ сэтгэлгээ</span>
                            <span class=""pill-tag"">💡 Бүтээлч хандлага</span>
                            <span class=""pill-tag"">🚀 Амжилт</span>
                        </div>
                    </div>",
                    X = 60,
                    Y = 90,
                    Width = 840,
                    Height = 520
                }
            }
        });

        return data;
    }
}
