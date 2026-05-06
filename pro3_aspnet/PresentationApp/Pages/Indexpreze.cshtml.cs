using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Text.Json;
using System.IO;
using System.Collections.Generic;

namespace PresentationApp.Pages;

public class PresentationData
{
    public List<PreziSlideData> Slides { get; set; } = new();
}

public class PreziSlideData
{
    public string Id { get; set; } = "";
    public double X { get; set; }
    public double Y { get; set; }
    public double Z { get; set; }
    public double Scale { get; set; } = 1.0;
    public string BgColor { get; set; } = "#ffffff";
    public double BgOpacity { get; set; } = 0.6;
    public List<SlideElement> Elements { get; set; } = new();
}

public class SlideElement
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = ""; // "text", "image"
    public string Content { get; set; } = "";
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
}

[IgnoreAntiforgeryToken(Order = 1001)]
public class IndexprezeModel : PageModel
{
    private readonly IWebHostEnvironment _env;

    public IndexprezeModel(IWebHostEnvironment env)
    {
        _env = env;
    }

    public string BackgroundColor { get; set; } = "#1e293b";
    public string? BackgroundImage { get; set; }
    
    // The main presentation data object
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
            using var stream = new FileStream(configFile, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            using var reader = new StreamReader(stream);
            var json = reader.ReadToEnd();
            Presentation = JsonSerializer.Deserialize<PresentationData>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new PresentationData();
        }
        else
        {
            // Create a default presentation if none exists
            Presentation.Slides.Add(new PreziSlideData 
            { 
                Id = "overview", 
                X = 500, Y = 0, Scale = 4 
            });
            Presentation.Slides.Add(new PreziSlideData 
            { 
                Id = "slide-1", 
                X = 0, Y = 0, Scale = 1,
                Elements = new List<SlideElement> {
                    new SlideElement { Id = "el-1", Type = "text", Content = "<h1>Welcome to Prezi Clone</h1>", X = 50, Y = 50, Width = 800, Height = 100 }
                }
            });
        }
    }

    public async Task<IActionResult> OnPostSavePresentationAsync([FromBody] PresentationData presentationData)
    {
        if (presentationData == null) return BadRequest();

        var dataFolder = Path.Combine(_env.WebRootPath, "data");
        Directory.CreateDirectory(dataFolder);
        var configFile = Path.Combine(dataFolder, "presentation_content.json");

        var newJson = JsonSerializer.Serialize(presentationData, new JsonSerializerOptions { WriteIndented = true });
        
        using (var stream = new FileStream(configFile, FileMode.Create, FileAccess.Write, FileShare.ReadWrite))
        using (var writer = new StreamWriter(stream))
        {
            await writer.WriteAsync(newJson);
        }

        return new JsonResult(new { success = true });
    }
}
