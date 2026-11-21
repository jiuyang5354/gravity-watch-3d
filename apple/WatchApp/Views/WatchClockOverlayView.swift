import SwiftUI

struct WatchClockOverlayView: View {
    let config: GravitySyncConfig
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1.0)) { context in
            ZStack {
                VStack {
                    HStack {
                        Spacer()
                        VStack(alignment: .trailing, spacing: -4) {
                            Text(formattedDate(for: context.date))
                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                .textCase(.uppercase)
                                .tracking(0.5)
                                .foregroundStyle(Color.white.opacity(isLuminanceReduced ? 0.50 : 0.92))
                                .shadow(color: .black.opacity(0.75), radius: 4, x: 0, y: 1)

                            Text(formattedTime(for: context.date))
                                .font(.system(size: 40, weight: .bold, design: .rounded))
                                .monospacedDigit()
                                .foregroundStyle(Color.white.opacity(isLuminanceReduced ? 0.72 : 1.0))
                                .lineLimit(1)
                                .minimumScaleFactor(0.75)
                                .shadow(color: .black.opacity(0.75), radius: 8, x: 0, y: 2)
                        }
                    }
                    .padding(.top, 4)
                    .padding(.trailing, 10)

                    Spacer()
                }

                if config.shouldShowComplications {
                    complicationsLayer
                        .opacity(isLuminanceReduced ? 0.45 : 1.0)
                }
            }
        }
        .allowsHitTesting(false)
    }

    private var complicationsLayer: some View {
        VStack {
            HStack {
                ZStack {
                    Circle()
                        .fill(Color.black.opacity(0.58))
                        .overlay(Circle().strokeBorder(Color.white.opacity(0.24), lineWidth: 1))
                    VStack(spacing: 1) {
                        Image(systemName: "sunset.fill")
                            .font(.system(size: 9, weight: .semibold))
                        Text("5:42")
                            .font(.system(size: 8, weight: .bold, design: .rounded))
                    }
                    .foregroundStyle(.white.opacity(0.92))
                }
                .frame(width: 30, height: 30)

                Spacer()
            }
            .padding(.top, 8)
            .padding(.leading, 8)

            Spacer()

            HStack {
                ZStack {
                    Circle()
                        .fill(Color.black.opacity(0.58))
                        .overlay(Circle().strokeBorder(Color.white.opacity(0.24), lineWidth: 1))
                    Circle()
                        .trim(from: 0, to: 0.68)
                        .stroke(Color.white, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                        .rotationEffect(.degrees(-110))
                        .padding(3)
                    Image(systemName: "mountain.2.fill")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .frame(width: 30, height: 30)

                Spacer()

                ZStack {
                    Circle()
                        .fill(Color.black.opacity(0.58))
                        .overlay(Circle().strokeBorder(Color.white.opacity(0.24), lineWidth: 1))
                    Circle()
                        .trim(from: 0, to: 0.74)
                        .stroke(Color.white, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .padding(3)
                    Circle()
                        .trim(from: 0, to: 0.62)
                        .stroke(Color.white.opacity(0.85), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .padding(6.5)
                    Circle()
                        .trim(from: 0, to: 0.50)
                        .stroke(Color.white.opacity(0.70), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .padding(10)
                }
                .frame(width: 30, height: 30)
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 4)
        }
    }

    private func formattedDate(for date: Date) -> String {
        date.formatted(
            .dateTime
                .weekday(.abbreviated)
                .day()
        )
    }

    private func formattedTime(for date: Date) -> String {
        date.formatted(
            .dateTime
                .hour(.twoDigits(amPM: .omitted))
                .minute(.twoDigits)
        )
    }
}
