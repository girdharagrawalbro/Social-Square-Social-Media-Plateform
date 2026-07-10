declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import { Component } from 'react';
  import { IconProps } from 'react-native-vector-icons/Icon';
  export default class MaterialCommunityIcons extends Component<IconProps> {}
}

declare module 'react-native-linear-gradient' {
  import { Component } from 'react';
  import { ViewProps } from 'react-native';
  export interface LinearGradientProps extends ViewProps {
    colors: string[];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    locations?: number[];
  }
  export default class LinearGradient extends Component<LinearGradientProps> {}
}

declare module 'react-native-image-picker' {
  export interface ImagePickerResponse {
    didCancel?: boolean;
    errorCode?: string;
    errorMessage?: string;
    assets?: Array<{
      uri?: string;
      width?: number;
      height?: number;
      fileSize?: number;
      type?: string;
      fileName?: string;
    }>;
  }
  export function launchImageLibrary(options: any, callback?: (res: ImagePickerResponse) => void): Promise<ImagePickerResponse>;
  export function launchCamera(options: any, callback?: (res: ImagePickerResponse) => void): Promise<ImagePickerResponse>;
}

declare module 'react-native-video' {
  import { Component } from 'react';
  import { ViewProps } from 'react-native';
  export interface VideoProps extends ViewProps {
    source: { uri: string } | number;
    paused?: boolean;
    resizeMode?: string;
    repeat?: boolean;
    controls?: boolean;
    muted?: boolean;
    onLoad?: (data: any) => void;
    onProgress?: (data: any) => void;
    onEnd?: () => void;
  }
  export default class Video extends Component<VideoProps> {}
}

declare module '@react-native-async-storage/async-storage' {
  export interface AsyncStorageStatic {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
  }
  const AsyncStorage: AsyncStorageStatic;
  export default AsyncStorage;
}
