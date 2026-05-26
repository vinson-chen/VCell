import { vcTokens } from '@vinson.hx/vc-design';
import {
  VCustomTabs,
  type CustomTabItem,
} from '@vinson.hx/vc-biz';

const DEFAULT_NAV_WIDTH = 240;

type LeftNavProps = Readonly<{
  width?: number;
  items: CustomTabItem[];
  activeKey: string;
  onItemsChange: (nextItems: CustomTabItem[]) => void;
  onActiveKeyChange: (nextKey: string) => void;
  onAddMenuImportTableFile?: (file: File) => void | Promise<void>;
}>;

export function LeftNav({
  width = DEFAULT_NAV_WIDTH,
  items,
  activeKey,
  onItemsChange,
  onActiveKeyChange,
  onAddMenuImportTableFile,
}: LeftNavProps) {

  return (
    <div
      style={{
        width,
        height: '100%',
        background: vcTokens.color.neutral.background.container,
        overflow: 'hidden',
      }}
      className="biz-custom-tabs-nav-wrapper"
    >
      <VCustomTabs
        mode="vertical"
        items={items}
        onItemsChange={onItemsChange}
        activeKey={activeKey}
        onActiveKeyChange={onActiveKeyChange}
        onAddMenuImportTableFile={onAddMenuImportTableFile}
        verticalWidth={width}
        verticalHeight={'100%'}
      />
    </div>
  );
}

export const LEFT_NAV_WIDTH = DEFAULT_NAV_WIDTH;
export { DEFAULT_NAV_WIDTH };