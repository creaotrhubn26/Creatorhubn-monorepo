import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Chip } from '@mui/material';
import type { RoleRoomFeedBrandSnapshot, RoleRoomFeedPost } from '../../services/roleRoomAgentService';
import FeedPostTile from './FeedPostTile';
import { describeApprovalState } from '../../utils/feedApprovalLabels';

type SortableFeedPostTileProps = {
  post: RoleRoomFeedPost;
  index: number;
  brandSnapshot: RoleRoomFeedBrandSnapshot | null;
  selected: boolean;
  onSelect: () => void;
};

export default function SortableFeedPostTile({
  post,
  index,
  brandSnapshot,
  selected,
  onSelect,
}: SortableFeedPostTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: post.id,
    disabled: post.locked,
  });

  const approval = describeApprovalState(post.approvalState);
  // Vis kun approval-chip når posten ikke er i default 'draft'-tilstand;
  // utkast er underforstått og chip-en skaper bare visuell støy.
  const showApprovalChip = post.approvalState && post.approvalState !== 'draft';

  return (
    <Box
      ref={setNodeRef}
      sx={{
        position: 'relative',
        zIndex: isDragging ? 5 : 0,
        opacity: isDragging ? 0.85 : 1,
        boxShadow: isDragging ? '0 12px 36px rgba(0,0,0,0.55)' : 'none',
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
    >
      <FeedPostTile
        post={post}
        index={index}
        brandSnapshot={brandSnapshot}
        selected={selected}
        onSelect={onSelect}
      />
      {showApprovalChip ? (
        <Chip
          size="small"
          label={approval.label}
          data-testid="feed-post-approval-chip"
          data-approval-state={post.approvalState}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            height: 20,
            fontSize: '0.66rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            bgcolor: approval.bgColor,
            color: approval.color,
            border: `1px solid ${approval.borderColor}`,
            backdropFilter: 'blur(4px)',
            zIndex: 2,
            '& .MuiChip-label': { px: 0.7 },
          }}
        />
      ) : null}
    </Box>
  );
}
