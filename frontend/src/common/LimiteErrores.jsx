/* eslint-disable react/prop-types */
import { Component } from "react";
import { Button } from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

// Si una pantalla falla al renderizar, se muestra un mensaje en lugar de una página en blanco.
class LimiteErrores extends Component {
  constructor(props) {
    super(props);
    this.state = { conError: false };
  }

  static getDerivedStateFromError() {
    return { conError: true };
  }

  componentDidCatch(error) {
    console.error("[portal-salud] error de interfaz:", error.message);
  }

  render() {
    if (!this.state.conError) return this.props.children;
    return (
      <main className="cd-superficie ps-estado" role="alert">
        <h1 className="ps-estado__titulo">Algo no salió bien</h1>
        <p className="ps-estado__texto">No pudimos mostrar esta pantalla. Recargá la página para intentar de nuevo.</p>
        <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => window.location.reload()}>
          Recargar
        </Button>
      </main>
    );
  }
}

export default LimiteErrores;
