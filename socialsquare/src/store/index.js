import visibilityReducer from './slices/visibilitySlice';
import userReducer from './slices/userSlice';
import postReducer from './slices/postsSlice';
import conversationReducer from './slices/conversationSlice';
import { combineReducers } from 'redux';

const rootReducer = combineReducers({
  conversation: conversationReducer,
  visibility: visibilityReducer,
  users: userReducer,
  posts: postReducer
});

export default rootReducer;

