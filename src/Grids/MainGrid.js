// Asegúrate de que estos imports están correctos
import * as React  from 'react';
import { useState } from 'react';
import Box from '@mui/material/Box';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarDensitySelector,
  GridToolbarFilterButton,
  GridToolbarExport,
  GridActionsCellItem,
  GridRowModes,
  GridRowEditStopReasons,
} from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Close';
import { Button,CircularProgress } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { API_URL } from '../Config/Config';

// Tema para DataGrid con idioma español
const theme = createTheme(
  {
    components: {
      MuiDataGrid: {
        styleOverrides: {
          columnHeader: {
            backgroundColor: '#8f2e2e', // Burdeos para los headers
            '& .MuiSvgIcon-root': {
              color: 'white'
            }
          },
          columnHeaderTitle: {
            color: 'white',
          },
          columnHeaderSortIcon: {
            color: 'white',
          },
          // Para el modo oscuro, asegurar texto blanco
          panel: {
            '&.MuiDataGrid-panelDark, .MuiDataGrid-filterPanelDark': {
              '& .MuiFormLabel-root': {
                color: 'white', // Etiquetas blancas en modo oscuro
              },
              '& .MuiInputBase-input': {
                color: 'white', // Texto blanco en inputs en modo oscuro
              },
              '& .MuiInputLabel-root': {
                color: 'white', // Etiquetas blancas en modo oscuro
              },
              '& .MuiTypography-root': {
                color: 'white', // Todo texto en blanco en modo oscuro
              }
            }
          },
          // Modo oscuro específico
          root: {
            '&.MuiDataGrid-root--darkMode': {
              '& .MuiDataGrid-cell': {
                color: 'white',
              },
              '& .MuiTablePagination-root': {
                color: 'white',
              },
              '& .MuiInputBase-input': {
                color: 'white',
              }
            }
          }
        },
      },
      // Modificar las etiquetas (MuiInputLabel)
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: '#8f2e2e', // Gris oscuro para todas las etiquetas
            '&.Mui-focused': {
              color: '#8f2e2e', // Mantener el color cuando está enfocado
            },
            '&.MuiFormLabel-filled': {
              color: '#8f2e2e', // Mantener el color cuando está lleno
            },
            // Para modo oscuro
            '.MuiDataGrid-panelDark &, .Mui-darkMode &': {
              color: 'white',
            }
          }
        }
      },
      // Modificar el Badge
      MuiBadge: {
        styleOverrides: {
          badge: {
            backgroundColor: '#8f2e2e', // Burdeos para el badge
            color: 'white', // Texto blanco en el badge
          }
        }
      },
      // Asegurar texto visible en filtros
      MuiFormLabel: {
        styleOverrides: {
          root: {
            color: '#8f2e2e', // Gris oscuro para etiquetas de formulario
            '&.Mui-focused': {
              color: '#8f2e2e', // Mantener color cuando está enfocado
            },
            // Para modo oscuro
            '.MuiDataGrid-dark &, .MuiDataGrid-panelDark &': {
              color: 'white',
            }
          }
        }
      },
      // Modificar el input para el filtro
      MuiInput: {
        styleOverrides: {
          input: {
            color: '#8f2e2e', // Gris oscuro para el texto
            // Para modo oscuro
            '.Mui-darkMode &, .MuiDataGrid-panelDark &': {
              color: 'white',
            }
          },
          root: {
            '&:before': {
              borderBottomColor: '#8f2e2e',
            },
            '&:hover:not(.Mui-disabled):before': {
              borderBottomColor: '#8f2e2e',
            },
            '&.Mui-focused:after': {
              borderBottomColor: '#8f2e2e',
            }
          }
        }
      },
      // Para los menús desplegables en filtros
      MuiMenu: {
        styleOverrides: {
          paper: {
            '& .MuiMenuItem-root': {
              color: '#333333', // Texto en menús en gris oscuro
            },
            // Para modo oscuro
            '&.MuiMenu-paper-darkMode .MuiMenuItem-root': {
              color: 'white',
            }
          }
        }
      }
    },
    // Configuración de la paleta de colores
    palette: {
      primary: {
        main: '#8f2e2e', // Burdeos como color principal
        dark: '#6e2323', // Versión más oscura para estados hover
      },
      text: {
        primary: '#333333', // Texto primario en gris oscuro
      },
      mode: 'light', // Modo por defecto (puede cambiar a 'dark' si es necesario)
    },
  },
  esES // Localización en español
);
// Ejemplo de CustomToolbar para exportar y demás
function CustomToolbar() {
  const [loading, setLoading] = useState(false);

  const handleDownloadCSV = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/exportAfiliadosExcel`);
      if (!response.ok) throw new Error('Error al generar el archivo');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Total_Afiliados.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error en descarga:', error);
      alert('Error al descargar el archivo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GridToolbarContainer
      sx={{ '.MuiButton-root': { color: '#4f5658', fontWeight: 'bold' } }}
    >
      <GridToolbarFilterButton />
      <Button
        onClick={handleDownloadCSV}
        startIcon={!loading && <DownloadIcon />}
        disabled={loading}
        sx={{ ml: 1 }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} color="inherit" />
            Generando...
          </Box>
        ) : (
          'CSV completo'
        )}
      </Button>
    </GridToolbarContainer>
  );
}

export default function MainGrid({ 
  rows = [], 
  columns = [], 
  fileNameVar,
  idField = 'clave_elector', // Nuevo prop para especificar qué campo usar como ID
  showActions = true, // Nuevo prop para controlar si mostrar o no las acciones
  defaultPageSize = 20, // Nuevo prop para especificar el tamaño de página predeterminado
  loading = false,
  paginationMode = 'client',
  rowCount = 0,
  paginationModel,
  onPaginationModelChange,
  ...props
}) {
  // Estado local para las filas y para el modelo de edición de fila
  const [gridRows, setGridRows] = React.useState(rows);
  const [rowModesModel, setRowModesModel] = React.useState({});

  React.useEffect(() => {
    setGridRows(rows);
  }, [rows]);

  // Función que se ejecuta al detener la edición (por ejemplo, para evitar que se pierda la edición si se quita el foco)
  const handleRowEditStop = (params, event) => {
    if (params.reason === GridRowEditStopReasons.rowFocusOut) {
      event.defaultMuiPrevented = true;
    }
  };

  const handleEditClick = (id) => () => {
    setRowModesModel((prev) => ({
      ...prev,
      [id]: { mode: GridRowModes.Edit },
    }));
  };

  const handleSaveClick = (id) => () => {
    setRowModesModel((prev) => ({
      ...prev,
      [id]: { mode: GridRowModes.View },
    }));
  };

  const handleDeleteClick = (id) => () => {
    setGridRows((prevRows) =>
      prevRows.filter((row) => row[idField] !== id)
    );
  };

  const handleCancelClick = (id) => () => {
    setRowModesModel((prev) => ({
      ...prev,
      [id]: { mode: GridRowModes.View, ignoreModifications: true },
    }));
    const editedRow = gridRows.find((row) => row[idField] === id);
    if (editedRow?.isNew) {
      setGridRows((prev) => prev.filter((row) => row[idField] !== id));
    }
  };

  // Función para procesar la actualización de una fila editada.
  const processRowUpdate = (newRow) => {
    const updatedRow = { ...newRow, isNew: false };
    setGridRows((prevRows) =>
      prevRows.map((row) =>
        row[idField] === newRow[idField] ? updatedRow : row
      )
    );
    return updatedRow;
  };

  const handleRowModesModelChange = (newModel) => {
    setRowModesModel(newModel);
  };

  // Agregar (o fusionar) una columna de acciones para la edición, solo si showActions es true
  const editableColumns = showActions 
    ? [
        ...columns,
        {
          field: 'actions',
          type: 'actions',
          headerName: 'Acciones',
          width: 100,
          getActions: (params) => {
            const isInEditMode =
              rowModesModel[params.id]?.mode === GridRowModes.Edit;
            if (isInEditMode) {
              return [
                <GridActionsCellItem
                  icon={<SaveIcon />}
                  label='Guardar'
                  onClick={handleSaveClick(params.id)}
                  color='inherit'
                />,
                <GridActionsCellItem
                  icon={<CancelIcon />}
                  label='Cancelar'
                  onClick={handleCancelClick(params.id)}
                  color='inherit'
                />,
              ];
            }
            return [
              <GridActionsCellItem
                icon={<EditIcon />}
                label='Editar'
                onClick={handleEditClick(params.id)}
                color='inherit'
              />,
              <GridActionsCellItem
                icon={<DeleteIcon />}
                label='Eliminar'
                onClick={handleDeleteClick(params.id)}
                color='inherit'
              />,
            ];
          },
        },
      ]
    : columns;

   return (
    <ThemeProvider theme={theme}>
      <DataGrid
        editMode={showActions ? 'row' : undefined}
        rows={gridRows}
        columns={editableColumns}
        getRowId={(row) => row[idField]}
        rowHeight={35}
        loading={loading}
        slotProps={{
          loadingOverlay: {
            variant: 'linear-progress',
            noRowsVariant: 'linear-progress',
          },
        }}
        density='compact'
        // Configuración de paginación condicionada
        paginationMode={paginationMode}
        rowCount={paginationMode === 'server' ? rowCount : undefined}
        paginationModel={paginationModel}
        onPaginationModelChange={onPaginationModelChange}
        // Usar initialState solo si no hay paginationModel
        initialState={!paginationModel ? {
          pagination: {
            paginationModel: { pageSize: defaultPageSize, page: 0 },
          },
        } : undefined}
        pageSizeOptions={[5, 10, 20, 50, 100]}
        rowModesModel={rowModesModel}
        onRowModesModelChange={handleRowModesModelChange}
        onRowEditStop={handleRowEditStop}
        processRowUpdate={showActions ? processRowUpdate : undefined}
        slots={{
          toolbar: (props) => (
            <CustomToolbar {...props} fileNameVar={fileNameVar} />
          ),
        }}
        disableRowSelectionOnClick
        sx={{
          width: '100%',
          '& .MuiDataGrid-main': { width: '100%' },
          '& .MuiDataGrid-virtualScroller': { width: '100%' },
          '& .MuiDataGrid-footerContainer': { width: '100%' }
        }}
        {...props} // Pasar cualquier otra propiedad
      />
    </ThemeProvider>
  );
}