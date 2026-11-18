// Error con código HTTP, mismo criterio que el resto de los backends de DITEC.
class CustomError extends Error {
  constructor(message, code = 500) {
    super(message);
    this.code = code;
  }
}

module.exports = CustomError;
