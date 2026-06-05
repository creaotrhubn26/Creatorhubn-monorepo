/**
 * TakeActionsMenu — popover-meny som åpnes fra "..."-knappen på take-thumbnails.
 *
 * Handlinger:
 *  - Sett som valgt take (selectTake)
 *  - Rediger notater (åpner liten prompt)
 *  - Slett take (deleteTake med bekreftelse)
 */
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { palette } from '../../../theme';
import {
  deleteTake,
  patchTake,
  selectTake,
  type SelftapeTake,
} from '../../../../services/roleRoomSelfTapesService';

interface Props {
  anchorEl: HTMLElement | null;
  take: SelftapeTake | null;
  isCurrent: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}

export default function TakeActionsMenu({
  anchorEl, take, isCurrent, onClose, onChanged,
}: Props) {
  if (!take) return null;

  const handleSelect = async () => {
    onClose();
    try {
      await selectTake(take.id);
      await onChanged();
    } catch (err) {
      console.error('selectTake failed', err);
    }
  };

  const handleNotes = async () => {
    onClose();
    const next = window.prompt('Notater for denne taken:', take.notes ?? '');
    if (next === null) return;
    try {
      await patchTake(take.id, { notes: next });
      await onChanged();
    } catch (err) {
      console.error('patchTake notes failed', err);
    }
  };

  const handleDelete = async () => {
    onClose();
    if (!window.confirm(`Slett Take ${take.take_number}? Dette kan ikke angres.`)) return;
    try {
      await deleteTake(take.id);
      await onChanged();
    } catch (err) {
      console.error('deleteTake failed', err);
    }
  };

  return (
    <Menu
      open={!!anchorEl}
      anchorEl={anchorEl}
      onClose={onClose}
      PaperProps={{
        sx: {
          bgcolor: palette.bgCardElevated,
          color: palette.textPrimary,
          border: `1px solid ${palette.border}`,
          minWidth: 200,
        },
      }}
    >
      {!isCurrent ? (
        <MenuItem onClick={handleSelect}>
          <ListItemIcon sx={{ color: palette.accentBright }}>
            <CheckCircleOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Sett som valgt take" />
        </MenuItem>
      ) : null}
      <MenuItem onClick={handleNotes}>
        <ListItemIcon sx={{ color: palette.textMuted }}>
          <NotesOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={take.notes ? 'Rediger notater' : 'Legg til notater'} />
      </MenuItem>
      <MenuItem onClick={handleDelete} sx={{ color: '#f87171' }}>
        <ListItemIcon sx={{ color: '#f87171' }}>
          <DeleteOutlineIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Slett take" />
      </MenuItem>
    </Menu>
  );
}
