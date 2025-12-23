import mitt from 'mitt';
type Events = {
  'request.centerOnSelection': void;
 'scene.changed': void;
};
export const bus = mitt<Events>();
