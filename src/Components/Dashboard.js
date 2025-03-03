import React from 'react';
import { Outlet } from 'react-router-dom';
import DashboardLayoutBasic from './ToolPad';

function Dashboard() {

  return (
    <DashboardLayoutBasic>
      <Outlet />
    </DashboardLayoutBasic>
  );
}

export default Dashboard;
