import * as React from 'react';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';

export default function ToolbarGrid() {

  return (
    <div style={{ height: 400, width: '100%' }}>
      <DataGrid
        slots={{
          toolbar: GridToolbar,
        }}
      />
    </div>
  );
}