---
name: fb-used-posts
description: >-
  Find Facebook group GPU sale posts for a named card or any model (不限)
  inside a date range, identify each seller, and merge them into
  public/data/used.json. Use when the user gives a graphics card or says 不限,
  gives a start and end date, and wants those listings saved to used.json.
---

# Facebook 二手顯卡

輸入是顯卡和日期範圍。顯卡是一個型號，或「不限」。日期是台北日曆日的起日和迄日，兩端都算。用 Google 找公開社團出售貼文，讀到賣家才寫入 `public/data/used.json`。用 Google，不用 `gpu_price_crawler`。

## 步驟

1. 用瀏覽器開 Google，查詢限 `site:facebook.com/groups`，自訂日期 `tbs=cdr:1,cd_min:M/D/YYYY,cd_max:M/D/YYYY`（月/日/年）。指定型號時，查詢帶該型號和「出售 OR 售 OR 賣」，翻頁直到這一頁沒有新的社團貼文連結。不限型號時，分開查 RTX 50、40、30、20 與 RX 7000、6000，每組都同樣翻頁，再把連結併起來。
   完成條件：區間內看過的出售連結都在清單裡，沒有停在第一頁。

2. 每筆留下連結、代號、新台幣整數開價、日期。摘要寫幾小時前或幾天前，就從今天的台北日期換算。摘要沒有時刻、只落在自訂區間裡的，日期記搜尋當天，並在回覆裡註明。整機合售、已售、徵收、故障無畫面，以及售價對不上該卡的，不留下。
   完成條件：留下的每一筆都有這四項，售價是該張卡的開價。

3. 用這個技能裡的腳本讀賣家。Chrome 某個設定檔已登入 Facebook 即可，腳本會自己找到並複製，只打開傳入的公開社團網址：

   ```
   python .cursor/skills/fb-used-posts/scripts/read_sellers.py <貼文網址...>
   ```

   標準輸出每行一筆 `{"link","seller","title"}`。讀不到賣家的網址只出現在標準錯誤。
   完成條件：寫入的每一筆 `seller` 都是貼文上的人名。讀不到賣家的不寫入。

4. 同一賣家、同一代號只留最低價；價格相同留日期較晚的那筆。同一賣家的不同代號各留一筆。同一篇裡的多張卡共用一個連結。
   完成條件：沒有兩筆的 `seller` 與 `code` 都相同。

5. 用 `save_used_posts` 的 merge 寫入 `public/data/used.json`。merge 以連結加代號去重，已存在的列不會被蓋過。
   完成條件：檔案裡這些連結的 `seller` 是步驟 3 印出的人名。

6. 在回覆裡放這次找到的結果表格，欄位依序是型號、日期、價格、賣家、連結、備註。這次新寫入的列，備註寫「新增」。已在檔案裡的列，備註留白。同一賣家被併掉的列，備註寫「併入最低價」。讀不到賣家、已售、整機、徵收、故障的列也放進表，備註寫原因。
   完成條件：表格含這六欄，而且每一筆這次新寫入的列，備註都是「新增」。

只打開腳本收到的公開社團貼文網址。不要打開 Messenger 或私人訊息。
