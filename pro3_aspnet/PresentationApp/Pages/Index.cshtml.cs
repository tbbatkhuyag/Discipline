using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Text.Json;
using System.IO;

namespace PresentationApp.Pages;

public class SlidePositionData
{
    public float X { get; set; }
    public float Y { get; set; }
    public float Z { get; set; }
    public float RotateX { get; set; }
    public float RotateY { get; set; }
    public float RotateZ { get; set; }
    public float Scale { get; set; }
}

[IgnoreAntiforgeryToken(Order = 1001)]
public class IndexModel : PageModel
{
    private readonly IWebHostEnvironment _env;

    public IndexModel(IWebHostEnvironment env)
    {
        _env = env;
    }

    public string BackgroundColor { get; set; } = "#1e293b";
    public string? BackgroundImage { get; set; }
    public Dictionary<string, SlidePositionData> SlidePositions { get; set; } = new();

    public void OnGet()
    {
        // Get background color from session
        if (HttpContext.Session.TryGetValue("PresentationBackgroundColor", out var colorBytes))
        {
            BackgroundColor = System.Text.Encoding.UTF8.GetString(colorBytes);
        }

        // Get background image from session
        if (HttpContext.Session.TryGetValue("PresentationBackgroundImage", out var imgBytes))
        {
            BackgroundImage = System.Text.Encoding.UTF8.GetString(imgBytes);
        }

        // Load slide positions
        var dataFolder = Path.Combine(_env.WebRootPath, "data");
        var configFile = Path.Combine(dataFolder, "slides_config.json");
        if (System.IO.File.Exists(configFile))
        {
            var json = System.IO.File.ReadAllText(configFile);
            SlidePositions = JsonSerializer.Deserialize<Dictionary<string, SlidePositionData>>(json) ?? new();
        }
    }

    public async Task<IActionResult> OnPostSavePositionsAsync([FromBody] Dictionary<string, SlidePositionData> positions)
    {
        if (positions == null) return BadRequest();

        var dataFolder = Path.Combine(_env.WebRootPath, "data");
        Directory.CreateDirectory(dataFolder);
        var configFile = Path.Combine(dataFolder, "slides_config.json");

        // Merge with existing config if any
        var existing = new Dictionary<string, SlidePositionData>();
        if (System.IO.File.Exists(configFile))
        {
            var json = await System.IO.File.ReadAllTextAsync(configFile);
            existing = JsonSerializer.Deserialize<Dictionary<string, SlidePositionData>>(json) ?? new();
        }

        foreach (var kvp in positions)
        {
            existing[kvp.Key] = kvp.Value;
        }

        var newJson = JsonSerializer.Serialize(existing, new JsonSerializerOptions { WriteIndented = true });
        await System.IO.File.WriteAllTextAsync(configFile, newJson);

        return new JsonResult(new { success = true });
    }
}
