/**
 * CreatorHub Norge Admin - Voting Board Management
 * 
 * Allows admins to:
 * - Create/edit/delete voting boards
 * - Manage which roles can create boards
 * - View voting statistics
 * - Respond to feature requests
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Card,
  CardContent,
  Chip,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Checkbox,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  HowToVote,
  Lightbulb,
  CheckCircle,
  Cancel,
  Schedule,
  Build,
  TrendingUp,
  Comment,
  Flag,
  Security,
  Group,
  Save,
  Refresh,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';

// ============================================
// INTERFACES
// ============================================

interface VotingBoard {
  id: string;
  group_id: string;
  title: string;
  description: string;
  board_type: string;
  status: 'active' | 'closed' | 'archived';
  allow_new_items: boolean;
  allow_comments: boolean;
  anonymous_voting: boolean;
  max_votes_per_user?: number;
  voting_deadline?: string;
  created_at: string;
  item_count?: number;
  total_votes?: number;
}

interface VotingItem {
  id: string;
  board_id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  upvotes: number;
  downvotes: number;
  score: number;
  admin_response?: string;
  created_at: string;
  creator_name?: string;
}

interface CommunityRole {
  id: string;
  name: string;
  color: string;
  slug: string;
}

interface VotingPermission {
  id: string;
  group_id: string;
  role_id: string;
  role_name?: string;
  role_color?: string;
  permission_type: string;
}

interface VotingBoardManagementProps {
  groupId: string;
}

// ============================================
// STATUS CONFIG
// ============================================

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactElement }> = {
  open: { label: 'Åpen', color: '#2196f3', icon: <Lightbulb fontSize="small" /> },
  under_review: { label: 'Under vurdering', color: '#ff9800', icon: <Schedule fontSize="small" /> },
  planned: { label: 'Planlagt', color: '#ce93d8', icon: <Schedule fontSize="small" /> },
  in_progress: { label: 'Under utvikling', color: '#ff5722', icon: <Build fontSize="small" /> },
  completed: { label: 'Fullført', color: '#4caf50', icon: <CheckCircle fontSize="small" /> },
  declined: { label: 'Avslått', color: '#f44336', icon: <Cancel fontSize="small" /> },
  duplicate: { label: 'Duplikat', color: '#9e9e9e', icon: <Flag fontSize="small" /> },
};

const permissionTypes = [
  { value: 'create_board', label: 'Opprette stemmebrett', description: 'Kan opprette nye stemmebrett' },
  { value: 'create_item', label: 'Legge til forslag', description: 'Kan legge til nye forslag' },
  { value: 'moderate', label: 'Moderere', description: 'Kan endre status og svare på forslag' },
  { value: 'admin', label: 'Full admin', description: 'Full kontroll over stemmesystemet' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function VotingBoardManagement({ groupId }: VotingBoardManagementProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState<VotingBoard[]>([]);
  const [roles, setRoles] = useState<CommunityRole[]>([]);
  const [permissions, setPermissions] = useState<VotingPermission[]>([]);
  const [pendingItems, setPendingItems] = useState<VotingItem[]>([]);

  // Dialog states
  const [editBoardDialog, setEditBoardDialog] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<VotingBoard | null>(null);
  const [respondDialog, setRespondDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VotingItem | null>(null);

  // Form states
  const [boardTitle, setBoardTitle] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  const [boardType, setBoardType] = useState('feature_request');
  const [boardStatus, setBoardStatus] = useState<'active' | 'closed' | 'archived'>('active');
  const [allowNewItems, setAllowNewItems] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  
  const [itemStatus, setItemStatus] = useState('');
  const [adminResponse, setAdminResponse] = useState('');
  const [confirmDeleteBoardId, setConfirmDeleteBoardId] = useState<string | null>(null);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchBoards = useCallback(async () => {
    try {
      const response = await apiRequest(`/api/community/voting/boards?groupId=${groupId}&status=all`);
      if (response.success) {
        setBoards(response.boards || []);
      }
    } catch (error) {
      console.error('Error fetching boards: ', error);
    }
  }, [groupId]);

  const fetchRoles = useCallback(async () => {
    try {
      const response = await apiRequest(`/api/community/groups/${groupId}/roles`);
      if (response.success) {
        setRoles(response.roles || []);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  }, [groupId]);

  const fetchPermissions = useCallback(async () => {
    try {
      const response = await apiRequest(`/api/community/voting/permissions?groupId=${groupId}`);
      if (response.success) {
        setPermissions(response.permissions || []);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  }, [groupId]);

  const fetchPendingItems = useCallback(async () => {
    try {
      // Fetch items that need admin attention
      const allItems: VotingItem[] = [];
      for (const board of boards) {
        const response = await apiRequest(`/api/community/voting/boards/${board.id}?status=open`);
        if (response.success && response.items) {
          allItems.push(...response.items.filter((item: VotingItem) => 
            item.status === 'open' || item.status === 'under_review'
          ));
        }
      }
      setPendingItems(allItems.sort((a, b) => b.score - a.score));
    } catch (error) {
      console.error('Error fetching pending items:', error);
    }
  }, [boards]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchBoards(), fetchRoles(), fetchPermissions()]);
      setLoading(false);
    };
    loadData();
  }, [fetchBoards, fetchRoles, fetchPermissions]);

  useEffect(() => {
    if (boards.length > 0) {
      fetchPendingItems();
    }
  }, [boards, fetchPendingItems]);

  // ============================================
  // ACTIONS
  // ============================================

  const handleSaveBoard = async () => {
    try {
      if (selectedBoard) {
        // Update existing board
        await apiRequest(`/api/community/voting/boards/${selectedBoard.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: boardTitle,
            description: boardDescription,
            status: boardStatus,
            allowNewItems,
            allowComments,
          }),
        });
      } else {
        // Create new board
        await apiRequest('/api/community/voting/boards', {
          method: 'POST',
          body: JSON.stringify({
            groupId,
            title: boardTitle,
            description: boardDescription,
            boardType,
            allowNewItems,
            allowComments,
          }),
        });
      }
      
      fetchBoards();
      setEditBoardDialog(false);
      resetBoardForm();
    } catch (error) {
      console.error('Error saving board:', error);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    setConfirmDeleteBoardId(boardId);
  };

  const executeDeleteBoard = async () => {
    if (!confirmDeleteBoardId) return;

    try {
      await apiRequest(`/api/community/voting/boards/${confirmDeleteBoardId}`, {
        method: 'DELETE',
      });
      fetchBoards();
    } catch (error) {
      console.error('Error deleting board:', error);
    }
    setConfirmDeleteBoardId(null);
  };

  const handleRespondToItem = async () => {
    if (!selectedItem) return;

    try {
      await apiRequest(`/api/community/voting/items/${selectedItem.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: itemStatus || undefined,
          adminResponse: adminResponse || undefined,
        }),
      });

      fetchPendingItems();
      setRespondDialog(false);
      setSelectedItem(null);
      setItemStatus('');
      setAdminResponse(', ');
    } catch (error) {
      console.error('Error responding to item:', error);
    }
  };

  const handleTogglePermission = async (roleId: string, permissionType: string) => {
    const existingPermission = permissions.find(
      p => p.role_id === roleId && p.permission_type === permissionType
    );

    try {
      if (existingPermission) {
        // Remove permission
        await apiRequest(`/api/community/voting/permissions/${existingPermission.id}`, {
          method: 'DELETE',
        });
      } else {
        // Add permission
        await apiRequest('/api/community/voting/permissions', {
          method: 'POST',
          body: JSON.stringify({
            groupId,
            roleId,
            permissionType,
          }),
        });
      }
      fetchPermissions();
    } catch (error) {
      console.error('Error toggling permission:', error);
    }
  };

  const resetBoardForm = () => {
    setSelectedBoard(null);
    setBoardTitle(', ');
    setBoardDescription(', ');
    setBoardType('feature_request');
    setBoardStatus('active');
    setAllowNewItems(true);
    setAllowComments(true);
  };

  const openEditBoard = (board?: VotingBoard) => {
    if (board) {
      setSelectedBoard(board);
      setBoardTitle(board.title);
      setBoardDescription(board.description || ', ');
      setBoardType(board.board_type);
      setBoardStatus(board.status);
      setAllowNewItems(board.allow_new_items);
      setAllowComments(board.allow_comments);
    } else {
      resetBoardForm();
    }
    setEditBoardDialog(true);
  };

  const hasPermission = (roleId: string, permissionType: string) => {
    return permissions.some(p => p.role_id === roleId && p.permission_type === permissionType);
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={600}>
          <HowToVote sx={{ mr: 1, verticalAlign: 'middle' }} />
          Stemmebrett-administrasjon
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => openEditBoard()}
          sx={{ bgcolor: '#FF8C00','&:hover': { bgcolor: '#e67e00' } }}
        >
          Nytt stemmebrett
        </Button>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label={`Stemmebrett (${boards.length})`} icon={<HowToVote />} iconPosition="start" />
          <Tab label={`Ventende forslag (${pendingItems.length})`} icon={<Lightbulb />} iconPosition="start" />
          <Tab label="Tillatelser" icon={<Security />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Boards Tab */}
      {activeTab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {boards.length === 0 ? (
            <Alert severity="info">
              Ingen stemmebrett opprettet ennå. Klikk "Nytt stemmebrett" for å opprette ett.
            </Alert>
          ) : (
            boards.map(board => (
              <Card key={board.id}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="h6">{board.title}</Typography>
                        <Chip
                          label={board.status === 'active' ? 'Aktiv' : board.status === 'closed' ? 'Lukket' : 'Arkivert'}
                          size="small"
                          color={board.status === 'active' ? 'success' : board.status === 'closed' ? 'error' : 'default'}
                        />
                      </Box>
                      {board.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {board.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Chip icon={<Lightbulb />} label={`${board.item_count || 0} forslag`} size="small" variant="outlined" />
                        <Chip icon={<TrendingUp />} label={`${board.total_votes || 0} stemmer`} size="small" variant="outlined" />
                        <Typography variant="caption" color="text.secondary">
                          Opprettet {formatDistanceToNow(new Date(board.created_at), { addSuffix: true, locale: nb })}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Rediger">
                        <IconButton onClick={() => openEditBoard(board)}>
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett">
                        <IconButton onClick={() => handleDeleteBoard(board.id)} color="error">
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      )}

      {/* Pending Items Tab */}
      {activeTab === 1 && (
        <Box>
          {pendingItems.length === 0 ? (
            <Alert severity="success">
              Ingen ventende forslag som trenger oppfølging.
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Score</TableCell>
                    <TableCell>Tittel</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Innsendt av</TableCell>
                    <TableCell>Dato</TableCell>
                    <TableCell>Handlinger</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Chip
                          label={item.score}
                          color={item.score > 0 ? 'success' : item.score < 0 ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {item.title}
                        </Typography>
                        {item.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {item.description.slice(0, 100)}...
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={statusConfig[item.status]?.label || item.status}
                          size="small"
                          sx={{
                            bgcolor: statusConfig[item.status]?.color,
                            color: 'white'}}
                        />
                      </TableCell>
                      <TableCell>{item.creator_name || 'Anonym'}</TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: nb })}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setSelectedItem(item);
                            setItemStatus(item.status);
                            setAdminResponse(item.admin_response || '');
                            setRespondDialog(true);
                          }}
                        >
                          Svar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Permissions Tab */}
      {activeTab === 2 && (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Administrer hvilke roller som kan utføre ulike handlinger i stemmesystemet.
            Brukere med "Full admin" tillatelse kan gjøre alt.
          </Alert>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Rolle</TableCell>
                  {permissionTypes.map(pt => (
                    <TableCell key={pt.value} align="center">
                      <Tooltip title={pt.description}>
                        <span>{pt.label}</span>
                      </Tooltip>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {roles.map(role => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <Chip
                        label={role.name}
                        sx={{ bgcolor: role.color, color: 'white' }}
                      />
                    </TableCell>
                    {permissionTypes.map(pt => (
                      <TableCell key={pt.value} align="center">
                        <Checkbox
                          checked={hasPermission(role.id, pt.value)}
                          onChange={() => handleTogglePermission(role.id, pt.value)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Edit Board Dialog */}
      <Dialog open={editBoardDialog} onClose={() => setEditBoardDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedBoard ? 'Rediger stemmebrett' : 'Opprett nytt stemmebrett'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Tittel"
              value={boardTitle}
              onChange={(e) => setBoardTitle(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Beskrivelse"
              value={boardDescription}
              onChange={(e) => setBoardDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
            />
            {!selectedBoard && (
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select value={boardType} onChange={(e) => setBoardType(e.target.value)} label="Type">
                  <MenuItem value="feature_request">Feature Requests</MenuItem>
                  <MenuItem value="poll">Avstemning</MenuItem>
                  <MenuItem value="priority">Prioritering</MenuItem>
                  <MenuItem value="feedback">Tilbakemelding</MenuItem>
                  <MenuItem value="general">Generelt</MenuItem>
                </Select>
              </FormControl>
            )}
            {selectedBoard && (
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={boardStatus}
                  onChange={(e) => setBoardStatus(e.target.value as any)}
                  label="Status"
                >
                  <MenuItem value="active">Aktiv</MenuItem>
                  <MenuItem value="closed">Lukket</MenuItem>
                  <MenuItem value="archived">Arkivert</MenuItem>
                </Select>
              </FormControl>
            )}
            <FormControlLabel
              control={<Switch checked={allowNewItems} onChange={(e) => setAllowNewItems(e.target.checked)} />}
              label="Tillat nye forslag"
            />
            <FormControlLabel
              control={<Switch checked={allowComments} onChange={(e) => setAllowComments(e.target.checked)} />}
              label="Tillat kommentarer"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditBoardDialog(false)}>Avbryt</Button>
          <Button
            onClick={handleSaveBoard}
            variant="contained"
            disabled={!boardTitle.trim()}
            startIcon={<Save />}
            sx={{ bgcolor: '#FF8C00', '&:hover': { bgcolor: '#e67e00' } }}
          >
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      {/* Respond to Item Dialog */}
      <Dialog open={respondDialog} onClose={() => setRespondDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Svar på forslag</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Typography variant="h6">{selectedItem.title}</Typography>
              {selectedItem.description && (
                <Typography variant="body2" color="text.secondary">
                  {selectedItem.description}
                </Typography>
              )}
              <Divider />
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select value={itemStatus} onChange={(e) => setItemStatus(e.target.value)} label="Status">
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <MenuItem key={key} value={key}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {config.icon}
                        {config.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Offisielt svar"
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                fullWidth
                multiline
                rows={4}
                placeholder="Skriv et offisielt svar som brukerne kan se..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRespondDialog(false)}>Avbryt</Button>
          <Button
            onClick={handleRespondToItem}
            variant="contained"
            sx={{ bgcolor: '#FF8C00','&:hover': { bgcolor:'#e67e00' } }}
          >
            Lagre svar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Board Dialog */}
      <Dialog
        open={!!confirmDeleteBoardId}
        onClose={() => setConfirmDeleteBoardId(null)}
      >
        <DialogTitle>Slett Stemmebrett</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Er du sikker på at du vil slette dette stemmebrettet? Alle forslag og stemmer vil bli slettet.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteBoardId(null)}>Avbryt</Button>
          <Button onClick={executeDeleteBoard} color="error" variant="contained">
            Slett
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

