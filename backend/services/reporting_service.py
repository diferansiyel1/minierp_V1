"""
Teknokent Muafiyet Raporu PDF Oluşturma Servisi
YMM (Yeminli Mali Müşavir) Formatında Raporlama

Bu modül şunları içerir:
- Aylık Muafiyet Raporu PDF
- Proje Özeti
- Gelir Analizi
- Personel Analizi
- Kurumlar Vergisi Hesaplaması
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, date
from io import BytesIO
import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from sqlalchemy.orm import Session
from sqlalchemy import extract

from .. import models, schemas
from .tax_service import TaxService


class ReportingService:
    """Teknokent Muafiyet Raporu PDF Oluşturma Servisi"""
    
    def __init__(self, db: Session):
        self.db = db
        self.tax_service = TaxService(db)
        self._register_fonts()
    
    def _register_fonts(self):
        """Türkçe karakter desteği için font kayıt"""
        font_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'fonts')
        try:
            if os.path.exists(os.path.join(font_dir, 'DejaVuSans.ttf')):
                pdfmetrics.registerFont(TTFont('DejaVuSans', os.path.join(font_dir, 'DejaVuSans.ttf')))
                pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', os.path.join(font_dir, 'DejaVuSans-Bold.ttf')))
        except Exception:
            pass  # Fallback to default fonts
    
    def _get_styles(self) -> Dict[str, ParagraphStyle]:
        """PDF stilleri oluştur"""
        styles = getSampleStyleSheet()
        
        # Türkçe karakter desteği için font belirleme
        font_name = 'DejaVuSans' if 'DejaVuSans' in pdfmetrics.getRegisteredFontNames() else 'Helvetica'
        font_bold = 'DejaVuSans-Bold' if 'DejaVuSans-Bold' in pdfmetrics.getRegisteredFontNames() else 'Helvetica-Bold'
        self._font_name = font_name
        self._font_bold = font_bold
        
        custom_styles = {
            'Title': ParagraphStyle(
                'CustomTitle',
                parent=styles['Title'],
                fontName=font_bold,
                fontSize=18,
                spaceAfter=20,
                alignment=1  # Center
            ),
            'Heading1': ParagraphStyle(
                'CustomHeading1',
                parent=styles['Heading1'],
                fontName=font_bold,
                fontSize=14,
                spaceBefore=15,
                spaceAfter=10,
                textColor=colors.HexColor('#1a365d')
            ),
            'Heading2': ParagraphStyle(
                'CustomHeading2',
                parent=styles['Heading2'],
                fontName=font_bold,
                fontSize=12,
                spaceBefore=10,
                spaceAfter=8,
                textColor=colors.HexColor('#2c5282')
            ),
            'Normal': ParagraphStyle(
                'CustomNormal',
                parent=styles['Normal'],
                fontName=font_name,
                fontSize=10,
                spaceAfter=6
            ),
            'Warning': ParagraphStyle(
                'Warning',
                parent=styles['Normal'],
                fontName=font_bold,
                fontSize=11,
                textColor=colors.red,
                backColor=colors.HexColor('#fed7d7'),
                borderPadding=10,
                spaceBefore=10,
                spaceAfter=10
            ),
            'TableHeader': ParagraphStyle(
                'TableHeader',
                parent=styles['Normal'],
                fontName=font_bold,
                fontSize=9,
                textColor=colors.white
            ),
            'TableCell': ParagraphStyle(
                'TableCell',
                parent=styles['Normal'],
                fontName=font_name,
                fontSize=9
            )
        }
        
        return custom_styles

    def _apply_table_style(self, table: Table, header_rows: int = 1) -> None:
        """Tablolara Türkçe fontlarını uygula."""
        font_name = getattr(self, "_font_name", "Helvetica")
        font_bold = getattr(self, "_font_bold", "Helvetica-Bold")

        base_style = [
            ('FONTNAME', (0, 0), (-1, -1), font_name),
            ('FONTNAME', (0, 0), (-1, header_rows - 1), font_bold),
        ]
        table.setStyle(TableStyle(base_style))
    
    def generate_monthly_exemption_report(
        self,
        tenant_id: Optional[int],
        year: int,
        month: int,
        company_info: Optional[Dict[str, Any]] = None
    ) -> BytesIO:
        """
        Aylık Teknokent Muafiyet Raporu PDF Oluştur
        
        Args:
            tenant_id: Kiracı ID
            year: Yıl
            month: Ay
            company_info: Firma bilgileri
            
        Returns:
            BytesIO: PDF dosyası
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )
        
        styles = self._get_styles()
        story = []
        
        # Vergi hesaplamalarını al
        tax_result = self.tax_service.calculate_monthly_tax_summary(tenant_id, year, month)
        
        # Firma bilgilerini al
        if company_info is None:
            company_info = self._get_company_info(tenant_id)
        
        # Ay adı
        month_names = [
            "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
            "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
        ]
        month_name = month_names[month] if 1 <= month <= 12 else str(month)
        
        # ==================== HEADER ====================
        story.append(Paragraph(
            f"TEKNOKENT MUAFİYET RAPORU",
            styles['Title']
        ))
        story.append(Paragraph(
            f"{month_name} {year}",
            styles['Heading2']
        ))
        story.append(Spacer(1, 0.5*cm))
        
        # Firma Bilgileri
        story.append(Paragraph("FİRMA BİLGİLERİ", styles['Heading1']))
        company_data = [
            ["Firma Unvanı:", company_info.get('company_name', '-')],
            ["Vergi No:", company_info.get('tax_id', '-')],
            ["Vergi Dairesi:", company_info.get('tax_office', '-')],
            ["Adres:", company_info.get('address', '-')],
        ]
        company_table = Table(company_data, colWidths=[4*cm, 12*cm])
        company_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), self._font_bold),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        self._apply_table_style(company_table, header_rows=0)
        story.append(company_table)
        story.append(Spacer(1, 0.5*cm))
        
        # ==================== SECTION A: PROJE ÖZETİ ====================
        story.append(Paragraph("A. PROJE ÖZETİ", styles['Heading1']))
        
        projects = self._get_active_projects(tenant_id)
        if projects:
            project_data = [["Proje Kodu", "Proje Adı", "Durum", "Muafiyet Kodu"]]
            for project in projects:
                project_data.append([
                    project.code,
                    project.name[:40] + "..." if len(project.name) > 40 else project.name,
                    project.status,
                    project.exemption_code
                ])
            
            project_table = Table(project_data, colWidths=[3*cm, 8*cm, 3*cm, 3*cm])
            project_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
            ]))
            self._apply_table_style(project_table)
            story.append(project_table)
        else:
            story.append(Paragraph("Aktif proje bulunmamaktadır.", styles['Normal']))
        
        story.append(Spacer(1, 0.5*cm))
        
        # ==================== SECTION B: GELİR ANALİZİ ====================
        story.append(Paragraph("B. GELİR ANALİZİ (KDV Muafiyeti Kod 351)", styles['Heading1']))
        
        income_data = [
            ["Kalem", "Tutar (TL)"],
            ["Toplam Muaf Gelir (Yazılım Satışları)", f"{tax_result.corporate_tax.total_exempt_income:,.2f}"],
            ["KDV Muafiyeti (%20)", f"{tax_result.corporate_tax.vat_exemption:,.2f}"],
        ]
        
        income_table = Table(income_data, colWidths=[10*cm, 6*cm])
        income_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        self._apply_table_style(income_table)
        story.append(income_table)
        story.append(Spacer(1, 0.5*cm))
        
        # ==================== SECTION C: PERSONEL ANALİZİ ====================
        story.append(Paragraph("C. PERSONEL ANALİZİ", styles['Heading1']))
        
        if tax_result.personnel_incentives:
            personnel_data = [["Personel", "Eğitim", "Gün", "Uzaktan", "GV İstisnası", "SGK Destek", "Toplam"]]
            for p in tax_result.personnel_incentives:
                personnel_data.append([
                    p.full_name[:20] + "..." if len(p.full_name) > 20 else p.full_name,
                    p.education_level[:10],
                    str(p.days_worked),
                    str(p.remote_days),
                    f"{p.calculated_income_tax_exemption:,.0f}",
                    f"{p.sgk_employer_discount:,.0f}",
                    f"{p.total_incentive:,.0f}"
                ])
            
            # Toplam satırı
            personnel_data.append([
                "TOPLAM", "", "", "",
                f"{sum(p.calculated_income_tax_exemption for p in tax_result.personnel_incentives):,.0f}",
                f"{sum(p.sgk_employer_discount for p in tax_result.personnel_incentives):,.0f}",
                f"{tax_result.total_personnel_incentive:,.0f}"
            ])
            
            personnel_table = Table(personnel_data, colWidths=[3.5*cm, 2*cm, 1.2*cm, 1.5*cm, 2.5*cm, 2.5*cm, 2.5*cm])
            personnel_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e2e8f0')),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
            ]))
            self._apply_table_style(personnel_table)
            story.append(personnel_table)
        else:
            story.append(Paragraph("Personel verisi bulunmamaktadır.", styles['Normal']))
        
        story.append(Spacer(1, 0.5*cm))
        
        # ==================== SECTION D: KURUMLAR VERGİSİ HESAPLAMASI ====================
        story.append(Paragraph("D. KURUMLAR VERGİSİ İSTİSNASI HESAPLAMASI", styles['Heading1']))
        
        corp_data = [
            ["Kalem", "Tutar (TL)"],
            ["Muaf Gelir (A)", f"{tax_result.corporate_tax.total_exempt_income:,.2f}"],
            ["Ar-Ge Giderleri (B)", f"{tax_result.corporate_tax.total_rd_expense:,.2f}"],
            ["İstisna Matrahı (A-B)", f"{tax_result.corporate_tax.exemption_base:,.2f}"],
            ["Kurumlar Vergisi İstisnası (%25)", f"{tax_result.corporate_tax.corporate_tax_exemption:,.2f}"],
        ]
        
        corp_table = Table(corp_data, colWidths=[10*cm, 6*cm])
        corp_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#c6f6d5')),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        self._apply_table_style(corp_table)
        story.append(corp_table)
        story.append(Spacer(1, 0.5*cm))
        
        # ==================== WARNING BOX ====================
        if tax_result.venture_capital_warning:
            story.append(Spacer(1, 0.3*cm))
            warning_table = Table(
                [[Paragraph(tax_result.venture_capital_warning, styles['Warning'])]],
                colWidths=[16*cm]
            )
            warning_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fed7d7')),
                ('BOX', (0, 0), (-1, -1), 2, colors.red),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ]))
            story.append(warning_table)
            story.append(Spacer(1, 0.5*cm))
        
        # ==================== TOPLAM VERGİ AVANTAJI ====================
        story.append(Paragraph("TOPLAM VERGİ AVANTAJI", styles['Heading1']))
        
        summary_data = [
            ["Kalem", "Tutar (TL)"],
            ["Kurumlar Vergisi İstisnası", f"{tax_result.corporate_tax.corporate_tax_exemption:,.2f}"],
            ["KDV Muafiyeti", f"{tax_result.corporate_tax.vat_exemption:,.2f}"],
            ["Personel Teşvikleri", f"{tax_result.total_personnel_incentive:,.2f}"],
            ["TOPLAM VERGİ AVANTAJI", f"{tax_result.total_tax_advantage:,.2f}"],
        ]
        
        summary_table = Table(summary_data, colWidths=[10*cm, 6*cm])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a365d')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#38a169')),
            ('TEXTCOLOR', (0, -1), (-1, -1), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('FONTSIZE', (0, -1), (-1, -1), 12),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
        ]))
        self._apply_table_style(summary_table)
        story.append(summary_table)
        
        # ==================== FOOTER ====================
        story.append(Spacer(1, 1*cm))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
        story.append(Spacer(1, 0.3*cm))
        footer_style = ParagraphStyle(
            'Footer',
            fontName=self._font_name,
            fontSize=8,
            textColor=colors.grey,
            alignment=1
        )
        story.append(Paragraph(
            f"Bu rapor {datetime.now().strftime('%d.%m.%Y %H:%M')} tarihinde MiniERP sistemi tarafından oluşturulmuştur.",
            footer_style
        ))
        story.append(Paragraph(
            "5746/4691 Sayılı Kanun kapsamında Teknokent vergi istisnaları için YMM onayı gereklidir.",
            footer_style
        ))
        
        # PDF oluştur
        doc.build(story)
        buffer.seek(0)
        
        return buffer
    
    def _get_company_info(self, tenant_id: Optional[int]) -> Dict[str, Any]:
        """Firma bilgilerini al"""
        if tenant_id:
            tenant = self.db.query(models.Tenant).filter(
                models.Tenant.id == tenant_id
            ).first()
            
            if tenant and tenant.settings:
                try:
                    import json
                    return json.loads(tenant.settings)
                except Exception:
                    pass
        
        return {
            "company_name": "Firma Adı Belirtilmemiş",
            "tax_id": "-",
            "tax_office": "-",
            "address": "-"
        }
    
    def _get_active_projects(self, tenant_id: Optional[int]) -> List[models.Project]:
        """Aktif projeleri al (Teknokent bayrağından bağımsız)."""
        query = self.db.query(models.Project).filter(
            models.Project.status == models.ProjectStatus.ACTIVE.value
        )
        
        if tenant_id:
            query = query.filter(models.Project.tenant_id == tenant_id)
        
        return query.all()


def get_reporting_service(db: Session) -> ReportingService:
    """ReportingService dependency injection helper"""
    return ReportingService(db)
