import { SHOW_COMPONENT, HIDE_COMPONENT } from './actions';

const initialState = {
  isVisible: false,
  id: null,
};

export default function reducer(state = initialState, action) {
  if (action.type === SHOW_COMPONENT) {
    return {
      isVisible: true,
      id: action.payload,
    }
  }
  else if (action.type === HIDE_COMPONENT) {
    return {
      isVisible: false,
      id: null,
    }
  }
  else {
    return state;
  }
}