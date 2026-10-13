using System.Globalization;
using Microsoft.Extensions.Options;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using TeacherPlatform.Application.Abstractions;
using TeacherPlatform.Application.Certificates;
using TeacherPlatform.Application.Options;

namespace TeacherPlatform.Infrastructure.Services;

public sealed class CertificatePdfRenderer : ICertificatePdfRenderer
{
    private readonly string _fontFamily;

    public CertificatePdfRenderer(IOptions<CertificateOptions> options)
    {
        _fontFamily = OperatingSystem.IsWindows()
            ? options.Value.WindowsFontFamily
            : options.Value.LinuxFontFamily;
    }

    public byte[] Render(CertificatePdfModel certificate)
    {
        var primary = Color.FromHex(certificate.PrimaryColor);
        var secondary = Color.FromHex(certificate.SecondaryColor);

        return Document.Create(document =>
        {
            document.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(28);
                page.PageColor(Colors.White);
                page.ContentFromRightToLeft();
                page.DefaultTextStyle(style => style.FontFamily(_fontFamily).FontSize(16).FontColor(Colors.Grey.Darken3));
                page.Content().Border(3).BorderColor(primary).Padding(8).Border(1).BorderColor(secondary)
                    .Padding(42).Column(column => ComposeCertificate(column, certificate, primary, secondary));
            });
        }).GeneratePdf();
    }

    private static void ComposeCertificate(
        ColumnDescriptor column,
        CertificatePdfModel certificate,
        Color primary,
        Color secondary)
    {
        column.Spacing(16);
        column.Item().AlignCenter().Text(certificate.TitleText).FontSize(32).Bold().FontColor(primary);
        column.Item().AlignCenter().Width(120).Height(3).Background(secondary);
        column.Item().AlignCenter().Text(certificate.BodyText).FontSize(17).FontColor(Colors.Grey.Darken2);
        column.Item().AlignCenter().PaddingVertical(10).Text(certificate.StudentName).FontSize(28).Bold().FontColor(Colors.Grey.Darken4);
        column.Item().AlignCenter().Text(text =>
        {
            text.Span("بعد اجتياز ");
            text.Span(certificate.QuizTitle).Bold();
        });
        column.Item().AlignCenter().ContentFromLeftToRight()
            .Text($"{certificate.Percentage:0.##}%").FontSize(22).Bold().FontColor(primary);
        column.Item().PaddingTop(22).Row(row =>
        {
            row.RelativeItem().AlignCenter().Column(details =>
            {
                details.Spacing(6);
                details.Item().Text("تاريخ الإصدار").FontSize(12).FontColor(Colors.Grey.Medium);
                details.Item().ContentFromLeftToRight()
                    .Text(certificate.IssuedAt.ToString("yyyy/MM/dd", CultureInfo.InvariantCulture));
            });
            row.RelativeItem().AlignCenter().Column(issuer =>
            {
                issuer.Spacing(6);
                issuer.Item().Text("الجهة المصدرة").FontSize(12).FontColor(Colors.Grey.Medium);
                issuer.Item().Text(certificate.IssuerName).Bold();
            });
            row.RelativeItem().AlignCenter().Column(number =>
            {
                number.Spacing(6);
                number.Item().Text("رقم الشهادة").FontSize(12).FontColor(Colors.Grey.Medium);
                number.Item().ContentFromLeftToRight().Text(certificate.CertificateNumber).FontSize(12);
            });
        });
    }
}
