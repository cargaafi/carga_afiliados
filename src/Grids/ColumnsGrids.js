
export const mainColumns = () => [
  { field: 'clave_elector_afiliado', headerName: 'Clave Elector Afiliado', width: 200 },
  { field: 'casa', headerName: 'Casa', headerAlign: 'center', width: 70, editable: true, align: 'center'  },
  { field: 'apellido_paterno', headerName: 'Apellido Paterno', width: 150, editable: true },
  { field: 'apellido_materno', headerName: 'Apellido Materno', width: 150, editable: true },
  { field: 'nombre', headerName: 'Nombre(s)', width: 150, editable: true },
  { field: 'telefono', headerName: 'Teléfono', width: 120, editable: true },
  { field: 'clave_elector', headerName: 'Clave Elector', width:200 }, 
  { field: 'seccion_electoral', headerName: 'S.Electoral', width: 120, editable: true, align: 'center' },
  { field: 'municipio', headerName: 'Municipio', width: 150, editable: true },
  { field: 'entidad_federativa', headerName: 'Entidad Federativa', width: 160, editable: true },
  { 
    field: 'fecha_subida', 
    headerName: 'Fecha Subida', 
    width: 160,
    renderCell: (params) => {
      const date = new Date(params.row.fecha_subida);
      return date.toLocaleString('es-MX', { 
        timeZone: 'America/Mexico_City',
        dateStyle: 'short',
        timeStyle: 'short'
      });
    }
  },
  { field: 'usuario_subida', headerName: 'Usuario Subida', width: 150 }
];

export const userColumns = [
  { field: 'id', headerName: 'ID', width: 150 },
  { field: 'user', headerName: 'Usuario', width: 250, editable: false },
  { field: 'role', headerName: 'Rol', width: 150, editable: false },
];