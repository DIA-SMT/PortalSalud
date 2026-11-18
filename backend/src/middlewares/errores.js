const { validationResult } = require("express-validator");
const CustomError = require("../utils/CustomError");

const validarCampos = (req, _res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return next(new CustomError(errores.array()[0].msg, 400));
  }
  next();
};

const noEncontrado = (_req, _res, next) => next(new CustomError("Recurso no encontrado", 404));

// eslint-disable-next-line no-unused-vars
const manejadorErrores = (error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "El cuerpo de la solicitud no es JSON válido" });
  }
  const propio = error instanceof CustomError;
  const codigo = propio && error.code >= 400 && error.code < 600 ? error.code : 500;
  if (codigo >= 500) console.error("[error]", error.message);
  // Los mensajes propios (CustomError) se muestran; los errores inesperados nunca exponen detalles.
  res.status(codigo).json({
    message: propio ? error.message : "Ups! Hubo un problema, por favor intentá más tarde",
  });
};

module.exports = { validarCampos, noEncontrado, manejadorErrores };
