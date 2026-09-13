import { useState } from "react";
import { View, Text, Input, Button, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { GRADE_OPTIONS } from "@/types";
import { uploadAvatar } from "@/api/user";
import type { UserGrade } from "@/types";
import "./index.scss";

interface ProfileEditorProps {
  nickName: string;
  grade: UserGrade;
  avatarUrl?: string;
  onCancel: () => void;
  onSave: (patch: {
    nickName: string;
    grade: UserGrade;
    avatarUrl: string;
  }) => void;
}

/** 完善资料弹层：微信官方头像昵称填写规范 + 学龄年级选择 */
const ProfileEditor = ({
  nickName,
  grade,
  avatarUrl = "",
  onCancel,
  onSave,
}: ProfileEditorProps) => {
  const [name, setName] = useState(nickName);
  const [selectedGrade, setSelectedGrade] = useState<UserGrade>(grade);
  const [avatarFileId, setAvatarFileId] = useState(avatarUrl);
  const [uploading, setUploading] = useState(false);

  // 选择微信头像后立即上传云存储得到永久 fileID（Loading 遮罩 + 失败友好提示）
  const handleChooseAvatar = async (e: { detail: { avatarUrl: string } }) => {
    const tempPath = e.detail.avatarUrl;
    if (!tempPath) return;
    setUploading(true);
    try {
      const fileID = await uploadAvatar(tempPath);
      setAvatarFileId(fileID);
      Taro.showToast({ title: "头像已就位 ✨", icon: "none" });
    } catch (err) {
      console.warn("头像上传失败:", err);
      Taro.showToast({ title: "头像上传失败，请重试", icon: "none" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Taro.showToast({ title: "昵称不能为空", icon: "none" });
      return;
    }
    onSave({
      nickName: trimmed,
      grade: selectedGrade,
      avatarUrl: avatarFileId,
    });
  };

  return (
    <View className="profile-editor">
      <View className="profile-editor__mask" onClick={onCancel} />
      <View className="profile-editor__card">
        <Text className="profile-editor__title">完善资料</Text>
        <Text className="profile-editor__subtitle">
          绑定微信信息，让桥智同学更了解你
        </Text>

        <View className="profile-editor__field profile-editor__field--avatar">
          <Text className="profile-editor__label">头像</Text>
          <View className="profile-editor__avatar-row">
            {avatarFileId ? (
              <Image
                className="profile-editor__avatar-img"
                src={avatarFileId}
                mode="aspectFill"
              />
            ) : (
              <View className="profile-editor__avatar-img profile-editor__avatar-img--empty">
                <Text>🧑‍🚀</Text>
              </View>
            )}
            <Button
              className="profile-editor__avatar-btn"
              openType="chooseAvatar"
              onChooseAvatar={handleChooseAvatar}
            >
              选择微信头像
            </Button>
          </View>
        </View>

        <View className="profile-editor__field">
          <Text className="profile-editor__label">昵称</Text>
          <Input
            className="profile-editor__input"
            type="nickname"
            value={name}
            onInput={(e) => setName(e.detail.value)}
            placeholder="请输入或一键填入微信昵称"
            maxlength={12}
          />
        </View>

        <View className="profile-editor__field">
          <Text className="profile-editor__label">学龄年级</Text>
          <View className="profile-editor__options">
            {GRADE_OPTIONS.map((g) => (
              <View
                key={g}
                className={`profile-editor__option ${
                  selectedGrade === g ? "profile-editor__option--active" : ""
                }`}
                onClick={() => setSelectedGrade(g)}
              >
                <Text>{g}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="profile-editor__actions">
          <View className="profile-editor__cancel" onClick={onCancel}>
            取消
          </View>
          <View className="profile-editor__save" onClick={handleSave}>
            保存资料
          </View>
        </View>
      </View>

      {uploading && (
        <View className="profile-editor__loading">
          <View className="profile-editor__loading-box">
            <Text className="profile-editor__loading-text">头像上传中...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default ProfileEditor;
