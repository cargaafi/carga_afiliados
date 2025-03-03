// Asegúrate de que estos imports están correctos
import * as React from 'react';
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

// Tema para DataGrid con idioma español
const theme = createTheme(
  {
    palette: {
      primary: { main: '#1976d2' },
    },
  },
  esES
);

// Ejemplo de CustomToolbar para exportar y demás
function CustomToolbar({ fileNameVar }) {
  return (
    <GridToolbarContainer
      sx={{ '.MuiButton-root': { color: '#4f5658', fontWeight: 'bold' } }}
    >
      <GridToolbarExport
        csvOptions={{ fileName: fileNameVar, utf8WithBom: true }}
      />
      <GridToolbarDensitySelector />
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
    </GridToolbarContainer>
  );
}

export default function MainGrid({ rows = [], columns = [], fileNameVar }) {
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
      prevRows.filter((row) => row.clave_elector !== id)
    );
  };

  const handleCancelClick = (id) => () => {
    setRowModesModel((prev) => ({
      ...prev,
      [id]: { mode: GridRowModes.View, ignoreModifications: true },
    }));
    const editedRow = gridRows.find((row) => row.clave_elector === id);
    if (editedRow?.isNew) {
      setGridRows((prev) => prev.filter((row) => row.clave_elector !== id));
    }
  };

  // Función para procesar la actualización de una fila editada.
  // Aquí podrías llamar a tu API para actualizar el registro en el back.
  const processRowUpdate = (newRow) => {
    const updatedRow = { ...newRow, isNew: false };
    setGridRows((prevRows) =>
      prevRows.map((row) =>
        row.clave_elector === newRow.clave_elector ? updatedRow : row
      )
    );
    return updatedRow;
  };

  const handleRowModesModelChange = (newModel) => {
    setRowModesModel(newModel);
  };

  // Agregar (o fusionar) una columna de acciones para la edición
  const editableColumns = [
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
  ];

  return (
    <ThemeProvider theme={theme}>
      <DataGrid
        editMode='row'
        rows={gridRows}
        columns={editableColumns}
        getRowId={(row) => row.clave_elector}
        rowHeight={31}
        density='compact'
        initialState={{
          pagination: {
            paginationModel: { pageSize: 20, page: 0 },
          },
        }}
        pageSizeOptions={[5, 10, 20, 50, 100]}
        rowModesModel={rowModesModel}
        onRowModesModelChange={handleRowModesModelChange}
        onRowEditStop={handleRowEditStop}
        processRowUpdate={processRowUpdate}
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
      />
    </ThemeProvider>
  );
}
