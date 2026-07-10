import { useEffect } from 'react';
import { appChannel } from './broadcast';

export function useBroadcast(type: string, handler: (data: any) => void) {
  useEffect(() => {
    const unsubscribe = appChannel.on(type, handler);
    return unsubscribe;
  }, [type, handler]);
}

export default useBroadcast;
