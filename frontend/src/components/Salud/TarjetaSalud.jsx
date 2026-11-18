/* eslint-disable react/prop-types */

// Tarjeta base del dashboard: superficie Ciudad Digital + cabecera con ícono.
const TarjetaSalud = ({ icono, titulo, children, className = "", id }) => (
  <section className={`cd-superficie ps-tarjeta ${className}`.trim()} aria-labelledby={id}>
    <div className="ps-tarjeta__cabecera">
      <span className="ps-tarjeta__icono" aria-hidden="true">
        {icono}
      </span>
      <h2 className="ps-tarjeta__titulo" id={id}>
        {titulo}
      </h2>
    </div>
    {children}
  </section>
);

export default TarjetaSalud;
