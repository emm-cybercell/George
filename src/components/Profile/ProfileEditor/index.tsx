import { useState } from "react";
import { View, Text, Input } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { GRADE_OPTIONS } from "@/types";
import type { UserGrade } from "@/types";
import "./index.scss";

interface ProfileEditorProps {
  nickName: string;
  grade: UserGrade;
  onCancel: () => void;
  onSave: (patch: { nickName: string; grade: UserGrade }) => void;
}

/** 编辑档案弹层：修改昵称与学龄年级 */
const ProfileEditor = ({
  nickName,
  grade,
  onCancel,
  onSave,
}: ProfileEditorProps) => {
  const [name, setName] = useState(nickName);
  const [selectedGrade, setSelectedGrade] = useState<UserGrade>(grade);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Taro.showToast({ title: "昵称不能为空", icon: "none" });
      return;
    }
    onSave({ nickName: trimmed, grade: selectedGrade });
  };

  return (
    <View className="profile-editor">
      <View className="profile-editor__mask" onClick={onCancel} />
      <View className="profile-editor__card">
        <Text className="profile-editor__title">编辑档案</Text>

        <View className="profile-editor__field">
          <Text className="profile-editor__label">昵称</Text>
          <Input
            className="profile-editor__input"
            value={name}
            onInput={(e) => setName(e.detail.value)}
            placeholder="请输入昵称（12 字以内）"
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
            保存
          </View>
        </View>
      </View>
    </View>
  );
};

export default ProfileEditor;
