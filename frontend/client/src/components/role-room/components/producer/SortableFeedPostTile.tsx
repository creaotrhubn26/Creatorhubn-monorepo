import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box } from '@mui/material';
import type { RoleRoomFeedBrandSnapshot, RoleRoomFeedPost } from '../../services/roleRoomAgentService';
import FeedPostTile from './FeedPostTile';

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
    </Box>
  );
}
