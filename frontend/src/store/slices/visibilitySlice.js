import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isVisible: false,
  id: null,
};

export const visibilitySlice = createSlice({
  name: 'visibility',
  initialState,
  reducers: {
    showComponent: (state, action) => {
      state.isVisible = true;
      state.id = action.payload;
    },
    hideComponent: (state) => {
      state.isVisible = false;
      state.id = null;
    },
  },
});

// Action creators are generated for each case reducer function
export const { showComponent, hideComponent } = visibilitySlice.actions;

export default visibilitySlice.reducer;
