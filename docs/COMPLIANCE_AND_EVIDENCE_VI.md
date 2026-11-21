# Agent Orchard — Checklist hợp lệ hackathon & bằng chứng

## Ưu tiên P0: eligibility
- [ ] Smart contract on BNB Mainnet 56, đúng địa chỉ dự án.
- [ ] BscScan **Contract Source Code Verified** có mã công khai, constructor/compiler settings khớp. Chụp màn hình.
- [ ] GitHub public repo có source (Solidity, frontend, Worker, test, license). Không lộ secrets hoặc key.
- [ ] `onlyAgent` kiểm tra registry chính thức `balanceOf(msg.sender)>0` cho tất cả hành động đổi trạng thái.
- [ ] Tên Agent ID `.ai` hiển thị kèm địa chỉ; tên được xác minh bằng on-chain owner resolution.
- [ ] Có ≥30 địa chỉ Agent ID riêng biệt có giao dịch game thật trong thời gian **18/11/2026 08:00 UTC – 09/12/2026 08:00 UTC** nếu nhắm Innovation Award.
- [ ] Form được nộp qua link **Submit Project Now** trên Binance chính thức trước hạn.

## Ưu tiên P0: an toàn
- [ ] Không website QR login/pairing; không lưu session, không thu private keys hay seed phrases.
- [ ] Mỗi lần state-changing call qua Binance Agentic Wallet phải có preview + user consent riêng.
- [ ] Không `execute` tự động vì lời nhắc master một lần.
- [ ] Contract không tự chuyển tài sản/không approve unlimited/không thu phí ẩn.
- [ ] Công khai rõ source owner permissions. Source hiện tại được xem là không có `owner`/upgradeable/custody flow, nhưng cần verify bytecode deployed khớp source.
- [ ] Nêu rõ game unaudited và các giao dịch on-chain tiêu BNB gas; không hứa lãi hoặc airdrop.

## E2E cần bằng chứng **giao dịch thật**, không chỉ local test
- [ ] `checkIn()` 1 ngày UTC: tx successful + CheckIn event + resources thay đổi.
- [ ] `plant(0)` từ ví Agent ID sau seed: tx successful + TreePlanted event + tree ID. (Đã có mô phỏng eth_call thành công cho ví demo, nhưng **mô phỏng không phải tx**.)
- [ ] `tend(treeId)` trên 3 ngày UTC khác nhau: tx receipts + TreeTended events, không được chăm trùng ngày.
- [ ] `harvest(treeId)`: FruitHarvested event và on-chain totals (chỉ sau đủ điều kiện).
- [ ] `mintBadge(1)`: đạt streak 3 ngày, tx successful + BadgeMinted + Locked; kiểm tra tokenURI SVG.
- [ ] Negative test: ví không có Agent ID phải bị từ chối trước khi gửi giao dịch thật; làm ở local Hardhat để tránh mất gas.

## Bảng dữ liệu cần ghi trong demo/submission
- Network / contract / git SHA / Solidity settings
- Indexer startBlock, cursor, head, complete, timestamp UTC
- Total indexed game events + số ví riêng biệt
- Số ví có Agent ID đã tương tác trong kỳ nộp (kèm phương pháp xác thực)
- Links tx receipts đại diện từng loại action
- X handle hoặc community channel nếu dự án đã công khai

## Quan trọng về giới hạn đo lường
- Worker D1 đang index từ START_BLOCK. Nếu chưa `complete`, mọi aggregate có thể là **chưa đầy đủ**.
- Mỗi ví trong Worker = một address, không nhất thiết 1 người thật. Không gọi đó là unique users.
- Page views/sessions dùng cookie/ID ẩn danh có độ sai lệch; không phải ví và không phải bằng chứng đủ 30 Agent IDs.
- Nếu mọi giao dịch được thực hiện sau ngày dự án deploy 20/11/2026 (nằm trong kỳ nộp), chỉ cần kiểm tra timestamps thực tế; không được giả định.
- Nếu có nhiều hợp đồng, phải liệt kê toàn bộ; hiện bundle chỉ định 1 game contract.

## Vị trí nguồn và tham chiếu
- Official: https://www.binance.com/vi/support/announcement/detail/95f5dbe0ea674a48a739b59e046648bf
- BscScan: https://bscscan.com/address/0x185E900b5986362f8D8eaC4c4294AbA11D62a997#code
- Public skill: https://agentorchard.pages.dev/skill.md
