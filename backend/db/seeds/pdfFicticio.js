// Genera un PDF mínimo y válido con un texto, para documentos FICTICIOS de prueba.
function crearPdfFicticio(lineas) {
  const escapar = (t) => t.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, "?");
  const texto = ["DOCUMENTO FICTICIO - SOLO PARA PRUEBAS", ...lineas]
    .map((l, i) => `BT /F1 ${i === 0 ? 14 : 11} Tf 60 ${760 - i * 22} Td (${escapar(l)}) Tj ET`)
    .join("\n");

  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(texto, "latin1")} >>\nstream\n${texto}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objetos.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const inicioXref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

module.exports = { crearPdfFicticio };
