// Progreso de las cargas, separado por usuario.
//
// Antes esto era un unico objeto compartido: con 56 casas subiendo, la barra
// de una mostraba el avance de otra y el "faltan 2 minutos" era de cualquiera.
// Ahora cada usuario tiene el suyo y solo puede leer el propio.
const VACIO = {
  progress: 0,
  speed: 0,
  estimatedRemaining: { minutes: 0, seconds: 0 },
};

// Una carga de 173 mil filas tarda segundos, no horas: lo que quedo sin tocar
// media hora es basura de una carga que se corto.
const VIDA_MS = 30 * 60 * 1000;

class UploadProgressManager {
  constructor() {
    this.porUsuario = new Map();
  }

  updateProgress(data, usuarioId = 'global') {
    const clave = String(usuarioId);
    const actual = this.porUsuario.get(clave) || { ...VACIO };
    this.porUsuario.set(clave, { ...actual, ...data, actualizado: Date.now() });
    this.limpiar();
  }

  getProgress(usuarioId = 'global') {
    const p = this.porUsuario.get(String(usuarioId));
    if (!p) return { ...VACIO };
    const { actualizado, ...resto } = p;
    return resto;
  }

  // al terminar la carga se borra, asi la proxima arranca de cero
  terminar(usuarioId = 'global') {
    this.porUsuario.delete(String(usuarioId));
  }

  limpiar() {
    const corte = Date.now() - VIDA_MS;
    for (const [k, v] of this.porUsuario)
      if ((v.actualizado || 0) < corte) this.porUsuario.delete(k);
  }
}

module.exports = new UploadProgressManager();
