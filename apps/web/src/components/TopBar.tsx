import { TopBar as TopBarFrame } from 'vc-biz';
import { Avatar, Typography, VcIcon, vcTokens } from 'vc-design';

/**
 * Figma `top_bar_1600` 文案与素材：品牌字 + 用户头像。
 * 结构完全由 vc-biz TopBar（OperationBar）提供，仅替换左右槽位内容。
 */
export function TopBar() {
  return (
    <TopBarFrame
      left={
        <Typography.Text
          style={{
            fontFamily: 'Agbalumo, cursive',
            fontSize: 24,
            lineHeight: '32px',
            color: vcTokens.color.primary.default,
          }}
        >
          VCell
        </Typography.Text>
      }
      right={
        <Avatar
          size={32}
          icon={
            <VcIcon
              type="user"
              fontSize={16}
              style={{
                width: 16,
                height: 16,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            />
          }
          style={{ cursor: 'pointer', flexShrink: 0 }}
        />
      }
    />
  );
}
