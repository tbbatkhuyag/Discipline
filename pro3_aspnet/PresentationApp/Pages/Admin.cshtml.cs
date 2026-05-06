using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.IO;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;

namespace PresentationApp.Pages;

public class AdminModel : PageModel
{
    private readonly IWebHostEnvironment _env;

    public AdminModel(IWebHostEnvironment env)
    {
        _env = env;
    }

    public string? BackgroundColor { get; set; }
    public string? BackgroundImage { get; set; }

    public void OnGet()
    {
        // Get background color from session
        if (HttpContext.Session.TryGetValue("PresentationBackgroundColor", out var colorBytes))
        {
            BackgroundColor = System.Text.Encoding.UTF8.GetString(colorBytes);
        }
        else
        {
            BackgroundColor = "#1e293b"; // Default color
        }

        // Get background image from session
        if (HttpContext.Session.TryGetValue("PresentationBackgroundImage", out var imgBytes))
        {
            BackgroundImage = System.Text.Encoding.UTF8.GetString(imgBytes);
        }
    }

    public async Task<IActionResult> OnPostAsync(string backgroundColor, IFormFile? backgroundImageFile, string? actionType)
    {
        if (actionType == "clearImage")
        {
            HttpContext.Session.Remove("PresentationBackgroundImage");
            BackgroundImage = null;
        }
        else if (backgroundImageFile != null && backgroundImageFile.Length > 0)
        {
            var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads");
            Directory.CreateDirectory(uploadsFolder);
            var uniqueFileName = Guid.NewGuid().ToString() + "_" + backgroundImageFile.FileName;
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);
            
            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await backgroundImageFile.CopyToAsync(fileStream);
            }
            
            var imageUrl = "/uploads/" + uniqueFileName;
            HttpContext.Session.Set("PresentationBackgroundImage", System.Text.Encoding.UTF8.GetBytes(imageUrl));
            BackgroundImage = imageUrl;
        }
        else if (HttpContext.Session.TryGetValue("PresentationBackgroundImage", out var imgBytes))
        {
            BackgroundImage = System.Text.Encoding.UTF8.GetString(imgBytes);
        }

        if (!string.IsNullOrEmpty(backgroundColor))
        {
            // Save to session
            var colorBytes = System.Text.Encoding.UTF8.GetBytes(backgroundColor);
            HttpContext.Session.Set("PresentationBackgroundColor", colorBytes);
            BackgroundColor = backgroundColor;
        }

        return Page();
    }
}
