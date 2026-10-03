import JSZip from 'jszip';

// Estilos del XLSX generado por esta aplicación. SheetJS CE conserva los datos
// y los formatos numéricos; la alineación y la negrita se escriben en el paquete.
const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="0.###############"/></numFmts>
  <fonts count="2">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
  </fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export async function styleCoordinateWorkbook(buffer, sheetCount) {
  const zip = await JSZip.loadAsync(buffer);
  zip.file('xl/styles.xml', styles);
  for (let index = 1; index <= sheetCount; index++) {
    const path = `xl/worksheets/sheet${index}.xml`;
    const xml = await zip.file(path).async('string');
    // Solo se procesa el XML producido por nuestro escritor, sin modificar valores.
    const formatted = xml.replace(/<c\b([^>]*?)(\/?)>/g, (tag, attributes, closing) => {
      const [, column, row] = attributes.match(/\br="([A-Z]+)(\d+)"/);
      if (index === 1 && Number(row) > 1) return tag;
      const header = Number(row) <= (index === 1 ? 1 : 2);
      const style = header || column === 'A' ? 1 : /^[CD]$/.test(column) ? 3 : 2;
      return `<c${attributes.replace(/\s+s="\d+"/g, '')} s="${style}"${closing}>`;
    });
    zip.file(path, formatted);
  }
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}
