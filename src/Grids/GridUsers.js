import React from 'react';
import 'react-data-grid/lib/styles.css';
import Box from '@mui/material/Box';
import { esES } from '@mui/material/locale';
import { DataGrid, GridToolbarContainer, GridToolbarColumnsButton, GridToolbarExport, GridToolbarDensitySelector, GridToolbarFilterButton } from '@mui/x-data-grid';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { BsFillTrashFill } from 'react-icons/bs';

const theme = createTheme(
    {
      palette: {
        primary: { main: '#455A64' },
      },
      components: {
        MuiDataGrid: {
          styleOverrides: {
            columnHeader: {
              backgroundColor: '#455A64',
              color: '#ffffff',
              '& .MuiSvgIcon-root': { color: '#ffffff' },
            },
            columnHeaderTitle: { color: '#ffffff', fontWeight: 600 },
            columnHeaderSortIcon: { color: '#ffffff' },
          },
        },
      },
    },
    esES
  );

function CustomToolbar({ fileNameVar }) {
  return (
    <GridToolbarContainer>
    </GridToolbarContainer>
  );
}

function GridUsers({ rows, columnsVar, onDelete, fileNameVar, showDeleteColumn = false, columnVisibility }) {
  let columns = [...columnsVar];
  if (showDeleteColumn) {
    const deleteButtonColumn = {
      field: 'delete',
      headerName: '',
      width: 50,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <BsFillTrashFill size={20} color="#455A64" onClick={() => onDelete(params.row.id)} style={{ cursor: 'pointer' }} />
      ),
    };
    columns.push(deleteButtonColumn);
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        width: '100%',
       mt: 0,
        pb: 2,
        alignGrids: 'center',
      }}
    >
      <ThemeProvider theme={theme}>
        <DataGrid
          autoHeight
          sx={{
            width: '100%',
            backgroundColor: 'background.paper',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: 'divider',
          }}
          density='compact'
          rowHeight={35} //height de rows
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          initialState={{
            columns: {
              columnVisibilityModel: {
                ...columnVisibility,
                id: false,
                applicant_name: false,
                rtari_level: false,
                position: false,
              },
            },
            pagination: {
              paginationModel: {
                pageSize: 20,
              },
            },
          }}
          slots={{
            toolbar: (props) => <CustomToolbar {...props} fileNameVar={fileNameVar} />,
          }}
          disableRowSelectionOnClick
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </ThemeProvider>
    </Box>
  );
}

export default GridUsers;
