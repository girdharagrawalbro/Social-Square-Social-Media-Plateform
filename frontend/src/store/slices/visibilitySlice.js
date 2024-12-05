import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isVisible: false,
  id: null, // To track which component trigger`ed visibility
};

export const visibilitySlice = createSlice({
  name: 'visibility',
  initialState,
  reducers: {
    showComponent: (state, action) => {
      state.isVisible = true;
      state.id = action.payload; // ID of the triggering component
    },
    hideComponent: (state) => {
      state.isVisible = false;
      state.id = null; // Reset ID when hidden
    },
  },
});

export const { showComponent, hideComponent } = visibilitySlice.actions;

export default visibilitySlice.reducer;
