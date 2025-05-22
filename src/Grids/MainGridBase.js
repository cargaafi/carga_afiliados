import * as React from 'react';
import { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  DataGrid,
  GridToolbarContainer,
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

// Tema de colores
const theme = createTheme(
  {
    components: {
      MuiDataGrid: {
        styleOverrides: {
          columnHeader: {
            backgroundColor: '#8f2e2e',
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
        },
      }
    },
    palette: {
      primary: {
        main: '#8f2e2e',
        dark: '#6e2323',
      },
      text: {
        primary: '#333333',
      },
      mode: 'light',
    },
  },
  esES
);

// Toolbar estándar
function CustomToolbar({ fileNameVar }) {
  return (
    <GridToolbarContainer
      sx={{ '.MuiButton-root': { color: '#4f5658', fontWeight: 'bold' } }}
    >
      <GridToolbarFilterButton />
      <GridToolbarExport
        csvOptions={{ fileName: fileNameVar, utf8WithBom: true }}
      />
    </GridToolbarContainer>
  );
}

// Componente principal
export default function MainGridBase({ 
  rows = [], 
  columns = [], 
  fileNameVar,
  idField = 'clave_elector',
  showActions = true,
  defaultPageSize = 20,
  loading = false,
  paginationMode = 'client',
  rowCount = 0,
  paginationModel,
  onPaginationModelChange,
  ...props
}) {
  const [gridRows, setGridRows] = useState(rows);
  const [rowModesModel, setRowModesModel] = useState({});

  React.useEffect(() => {
    setGridRows(rows);
  }, [rows]);

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
        density='compact'
        paginationMode={paginationMode}
        rowCount={paginationMode === 'server' ? rowCount : undefined}
        paginationModel={paginationModel}
        onPaginationModelChange={onPaginationModelChange}
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
          toolbar: () => <CustomToolbar fileNameVar={fileNameVar} />,
        }}
        disableRowSelectionOnClick
        sx={{
          width: '100%',
          '& .MuiDataGrid-main': { width: '100%' },
          '& .MuiDataGrid-virtualScroller': { width: '100%' },
          '& .MuiDataGrid-footerContainer': { width: '100%' },
        }}
        {...props}
      />
    </ThemeProvider>
  );
}
