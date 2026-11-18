// Categorías de datos de salud declarables (mismas que acepta el backend).
export const CATEGORIAS_SALUD = {
  alergia: {
    titulo: "Alergias conocidas",
    singular: "alergia",
    vacio: "No declaraste alergias.",
    ejemplo: "Por ejemplo: alergia a la penicilina",
  },
  antecedente: {
    titulo: "Antecedentes médicos",
    singular: "antecedente",
    vacio: "No declaraste antecedentes.",
    ejemplo: "Por ejemplo: cirugía de rodilla en 2019",
  },
  condicion: {
    titulo: "Condiciones relevantes",
    singular: "condición",
    vacio: "No declaraste condiciones relevantes.",
    ejemplo: "Algo que el servicio de salud deba tener en cuenta",
  },
  medicacion: {
    titulo: "Medicación habitual",
    singular: "medicación",
    vacio: "No declaraste medicación habitual.",
    ejemplo: "Nombre del medicamento y frecuencia",
  },
};
