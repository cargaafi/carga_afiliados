import * as React from 'react';
import {
  MenuItem,
  Divider,
  Stack,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  AccountPreview,
  SignOutButton,
  AccountPopoverFooter,
} from '@toolpad/core/Account';
import SettingsIcon from '@mui/icons-material/Settings';
//import UserConfig from '../Routes/UserConfig';
import { useDialogs } from '@toolpad/core';

function ConfigDialog({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
      <DialogTitle>Configuración de Usuario</DialogTitle>
      <DialogContent>
        <p>Configuración y ajustes del usuario.</p>
        {/* Aquí puedes incluir el componente UserConfig */}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

// En el componente donde quieras abrir el diálogo
function CustomMenu() {
  const dialogs = useDialogs();

  const handleOpenConfig = async () => {
    await dialogs.open(ConfigDialog);
  };

  return (
    <Stack direction='column'>
      <AccountPreview variant='expanded' />
      <Divider />
      <MenuItem onClick={handleOpenConfig}>
        <ListItemIcon>
          <SettingsIcon fontSize='small' />
        </ListItemIcon>
        Configuración
      </MenuItem>
      <Divider />
      <AccountPopoverFooter>
        <SignOutButton />
      </AccountPopoverFooter>
    </Stack>
  );
}
export default CustomMenu;
