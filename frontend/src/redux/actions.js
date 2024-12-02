export const SHOW_COMPONENT = 'SHOW_COMPONENT';
export const HIDE_COMPONENT = 'HIDE_COMPONENT';

export const showComponent = (id) => ({
  type: SHOW_COMPONENT,
  payload: id,
});

export const hideComponent = () => ({
  type: HIDE_COMPONENT,
});