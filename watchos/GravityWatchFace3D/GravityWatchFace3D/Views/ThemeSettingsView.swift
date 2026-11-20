import SwiftUI
import WatchKit

struct ThemeSettingsView: View {
    @Binding var selectedTheme: WatchFaceTheme
    @Binding var selectedDensity: DensityPreset
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(WatchFaceTheme.allCases) { theme in
                        Button {
                            selectedTheme = theme
                            WKInterfaceDevice.current().play(.click)
                            dismiss()
                        } label: {
                            HStack(spacing: 10) {
                                Image(decorative: ProceduralTextureGenerator.previewIcon(for: theme), scale: 2.0)
                                    .resizable()
                                    .interpolation(.high)
                                    .frame(width: 26, height: 26)

                                VStack(alignment: .leading, spacing: 1) {
                                    Text(theme.displayName)
                                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                                        .foregroundStyle(.primary)

                                    Text(theme.subtitle)
                                        .font(.system(size: 11, weight: .medium, design: .rounded))
                                        .foregroundStyle(.secondary)
                                }

                                Spacer()

                                if theme == selectedTheme {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(theme.accentColor)
                                }
                            }
                            .padding(.vertical, 2)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text("3D 表盘场景")
                }

                Section {
                    Picker("物体尺寸与数量", selection: $selectedDensity) {
                        ForEach(DensityPreset.allCases) { preset in
                            Text(preset.displayName).tag(preset)
                        }
                    }
                } header: {
                    Text("物理密度")
                }
            }
            .navigationTitle("切换 3D 场景")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
