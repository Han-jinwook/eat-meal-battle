import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import StarRating from './StarRating';

// Supabase ?대씪?댁뼵??珥덇린??const supabase = createClient();

interface MyMealRatingProps {
  mealId: string;
}

interface MenuItemRating {
  menu_item_id: string;
  rating: number;
}

/**
 * 湲됱떇 ?꾩껜??????됯퇏 ?됱젏???쒖떆?섍퀬 ?ъ슜?먭? ?됱젏??留ㅺ만 ???덈뒗 而댄룷?뚰듃
 * ?됯퇏 ?됱젏? "(4.2)" ?뺤떇?쇰줈 ?쒖떆?? * 湲됱떇 ?됱젏? ?대떦 湲됱떇??硫붾돱 ?꾩씠???됱젏?ㅼ쓽 ?됯퇏?쇰줈 怨꾩궛?? * 
 * ?⑥씪 釉뚮씪?곗? ?명솚?깆쓣 ?꾪븳 ?덉쟾?μ튂 異붽?:
 * - 而댄룷?뚰듃 留덉슫???곹깭 異붿쟻?쇰줈 ?몃쭏?댄듃 ???곹깭 ?낅뜲?댄듃 諛⑹?
 * - ??대㉧ ?뺣━ 湲곕뒫?쇰줈 硫붾え由??꾩닔 諛⑹?
 * - 鍮꾨룞湲??묒뾽 痍⑥냼 湲곕뒫?쇰줈 遺덊븘?뷀븳 ?ㅽ듃?뚰겕 ?붿껌 諛⑹?
 */
const MyMealRating: React.FC<MyMealRatingProps> = ({ mealId }) => {
  const [user, setUser] = useState<any>(null);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [menuItemRatings, setMenuItemRatings] = useState<MenuItemRating[]>([]);
  
  // 而댄룷?뚰듃 留덉슫???곹깭 異붿쟻
  const isMounted = useRef<boolean>(true);
  // ??대㉧ 李몄“ ???  const timerRef = useRef<number | null>(null);

  // ?ъ슜???뺣낫 媛?몄삤湲?  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user);
    };
    getUser();
  }, []);

  // 湲됱떇??硫붾돱 ?꾩씠??ID 紐⑸줉 議고쉶
  const fetchMenuItems = async () => {
    if (!mealId) return [];

    try {
      console.log('湲됱떇 硫붾돱 ?꾩씠??議고쉶 ?쒖옉:', mealId);
      
      // ?대떦 湲됱떇??硫붾돱 ?꾩씠??ID 紐⑸줉 議고쉶
      // 'menu_item_id' ???'id' 而대읆 ?ъ슜 - ?뚯씠釉?援ъ“??留욊쾶 ?섏젙
      const { data, error } = await supabase
        .from('meal_menu_items')
        .select('id')
        .eq('meal_id', mealId);
        
      if (error) {
        console.error('硫붾돱 ?꾩씠??議고쉶 ?ㅻ쪟:', error.message);
        return [];
      }
      
      if (!data || data.length === 0) {
        console.log('硫붾돱 ?꾩씠?쒖씠 ?놁쓬');
        return [];
      }
      
      console.log('硫붾돱 ?꾩씠??議고쉶 寃곌낵:', data.length, '媛???ぉ');
      // item.menu_item_id ???item.id ?ъ슜
      return data.map(item => item.id);
    } catch (error) {
      console.error('硫붾돱 ?꾩씠??議고쉶 以??ㅻ쪟 諛쒖깮:', error);
      return [];
    }
  };

  // 硫붾돱 ?꾩씠??蹂꾩젏???됯퇏??怨꾩궛?섏뿬 湲됱떇 ?됱젏 ???  const calculateAndSaveMealRating = async () => {
    if (!mealId || !user) return;

    try {
      // 硫붾돱 ?꾩씠??ID 紐⑸줉 議고쉶
      const menuItemIds = await fetchMenuItems();
      if (menuItemIds.length === 0) {
        // 硫붾돱 ?꾩씠???먯껜媛 ?놁쑝硫?湲됱떇 ?됱젏????젣
        await saveRating(null);
        setMenuItemRatings([]);
        setMyRating(null);
        return;
      }
      
      console.log('??硫붾돱 ?꾩씠???됱젏 議고쉶 ?쒖옉:', menuItemIds.length, '媛???ぉ');
      
      // ?ъ슜?먯쓽 硫붾돱 ?꾩씠???됱젏 議고쉶
      const { data, error } = await supabase
        .from('menu_item_ratings')
        .select('menu_item_id, rating')
        .eq('user_id', user.id)
        .in('menu_item_id', menuItemIds);
        
      if (error) {
        console.error('硫붾돱 ?꾩씠???됱젏 議고쉶 ?ㅻ쪟:', error.message);
        return;
      }
      
      if (!data || data.length === 0) {
        // 硫붾돱 ?꾩씠??蹂꾩젏??紐⑤몢 ??젣??寃쎌슦 湲됱떇 ?됱젏????젣
        console.log('硫붾돱 ?꾩씠???됱젏???놁쓬, 湲됱떇 ?됱젏 row ??젣');
        setMenuItemRatings([]);
        setMyRating(null);
        await saveRating(null);
        return;
      }
      
      console.log('硫붾돱 ?꾩씠???됱젏 議고쉶 寃곌낵:', data.length, '媛???ぉ');
      setMenuItemRatings(data);
      
      // 硫붾돱 ?꾩씠??蹂꾩젏???됯퇏 怨꾩궛
      const avgItemRating = calculateAverageRating(data);
      
      // 怨꾩궛???됯퇏??meal_ratings ?뚯씠釉붿뿉 ???      await saveRating(avgItemRating); // avgItemRating??null?대㈃ ??젣
      setMyRating(avgItemRating);
    } catch (error) {
      console.error('硫붾돱 ?꾩씠???됱젏 議고쉶 以??ㅻ쪟 諛쒖깮:', error);
    }
  };

  // ??湲됱떇 ?됱젏 議고쉶 ?⑥닔
  const fetchMyRating = async () => {
    if (!mealId || !user) return;

    try {
      console.log(' ??湲됱떇 ?됱젏 議고쉶 ?쒕룄 - 湲됱떇 ID:', mealId, '?ъ슜??ID:', user.id);
      
      // meal_ratings ?뚯씠釉붿뿉?????됱젏 議고쉶 - maybeSingle ???limit(1) ?ъ슜
      const { data, error } = await supabase
        .from('meal_ratings')
        .select('rating')
        .eq('meal_id', mealId)
        .eq('user_id', user.id)
        .limit(1);

      if (error) {
        console.error(' ???됱젏 議고쉶 ?ㅻ쪟:', error.message);
        return;
      }

      // ?곗씠??諛곗뿴?먯꽌 泥?踰덉㎏ ??ぉ ?ъ슜 (?놁쑝硫?null 泥섎━)
      if (data && data.length > 0) {
        console.log(' ???됱젏 議고쉶 ?깃났:', data[0].rating);
        setMyRating(data[0].rating);
      } else {
        console.log(' ??湲됱떇 ?됱젏 ?놁쓬, 硫붾돱 ?꾩씠???됱젏 湲곕컲?쇰줈 怨꾩궛 ?쒕룄');
        setMyRating(null);
        // 硫붾돱 ?꾩씠??蹂꾩젏???됯퇏??怨꾩궛?섏뿬 湲됱떇 ?됱젏 ???        await calculateAndSaveMealRating();
      }
    } catch (error) {
      console.error(' ???됱젏 議고쉶 以??ㅻ쪟 諛쒖깮:', error);
    }
  };

  // 湲됱떇 ?됱젏 ?듦퀎 議고쉶 ?⑥닔
  const fetchMealRatingStats = async () => {
    if (!mealId) return;

    try {
      console.log('湲됱떇 ?됱젏 ?듦퀎 議고쉶 ?쒖옉 - 湲됱떇 ID:', mealId);
      
      // meal_rating_stats ?뚯씠釉붿뿉???됯퇏 ?됱젏 議고쉶 - maybeSingle ???get ?ъ슜
      const { data, error } = await supabase
        .from('meal_rating_stats')
        .select('avg_rating')
        .eq('meal_id', mealId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('湲됱떇 ?됱젏 ?듦퀎 議고쉶 ?ㅻ쪟:', error.message);
        return;
      }

      // ?곗씠??諛곗뿴?먯꽌 泥?踰덉㎏ ??ぉ ?ъ슜 (?놁쑝硫?null 泥섎━)
      if (data && data.length > 0 && data[0].avg_rating) {
        console.log('湲됱떇 ?됱젏 ?듦퀎 議고쉶 ?깃났:', data[0].avg_rating);
        setAvgRating(data[0].avg_rating);
      } else {
        console.log('湲됱떇 ?됱젏 ?듦퀎 ?놁쓬');
        setAvgRating(null);
      }
    } catch (error) {
      console.error('湲됱떇 ?됱젏 ?듦퀎 議고쉶 以??ㅻ쪟 諛쒖깮:', error);
    }
  };

  // ?됱젏 ?됯퇏 怨꾩궛 ?⑥닔
  const calculateAverageRating = (ratings: MenuItemRating[]): number | null => {
    if (!ratings || ratings.length === 0) return null;
    
    const sum = ratings.reduce((total, item) => total + item.rating, 0);
    const avg = sum / ratings.length;
    
    console.log('?됱젏 ?됯퇏 怨꾩궛:', sum, '/', ratings.length, '=', avg);
    return Math.round(avg * 10) / 10; // ?뚯닔???섏㎏ ?먮━?먯꽌 諛섏삱由쇳븯??泥⑥㎏ ?먮━源뚯?留??쒖떆 (4.53 -> 4.5 / 3.75 -> 3.8)
  };

  // 蹂꾩젏 ?④린湲?API ?몄텧 ?⑥닔 (?⑥씪 釉뚮씪?곗? ?명솚??媛뺥솕)
  const submitRating = async (rating: number) => {
    if (!mealId || !user) return;
    if (!isMounted.current) return; // 而댄룷?뚰듃 留덉슫???곹깭 ?뺤씤
    
    setIsLoading(true);
    timerRef.current = null; // ??대㉧ 由ъ뀑

    try {
      console.log('湲됱떇 ?됱젏 ?쒖텧 ?쒖옉:', mealId, rating);
      
      // ?⑥씪 釉뚮씪?곗? ?명솚?? API ?붿껌????꾩븘??異붽?
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10珥???꾩븘??      
      // 湲곗〈 ??ぉ ?덈뒗吏 ?뺤씤 (signal 異붽?)
      const { data: existingRating, error: fetchError } = await supabase
        .from('meal_ratings')
        .select('id')
        .eq('user_id', user.id)
        .eq('meal_id', mealId)
        .abortSignal(controller.signal)
        .maybeSingle();

      clearTimeout(timeoutId);
      
      // 留덉슫???곹깭 ?ㅼ떆 ?뺤씤
      if (!isMounted.current) {
        console.log('而댄룷?뚰듃 ?몃쭏?댄듃 ?곹깭, API ?묒뾽 以묐떒');
        return;
      }
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('湲곗〈 ?됱젏 議고쉶 ?ㅻ쪟:', fetchError);
        throw fetchError;
      }

      if (existingRating) {
        // 湲곗〈 ?됱젏 ?낅뜲?댄듃
        const { error } = await supabase
          .from('meal_ratings')
          .update({ rating: rating })
          .eq('id', existingRating.id);

        if (error) throw error;
        console.log('湲곗〈 湲됱떇 ?됱젏 ?낅뜲?댄듃 ?깃났');
      } else {
        // ???됱젏 異붽?
        const { error } = await supabase
          .from('meal_ratings')
          .insert([
            { user_id: user.id, meal_id: mealId, rating: rating }
          ]);

        if (error) throw error;
        console.log('??湲됱떇 ?됱젏 異붽? ?깃났');
      }

      // 留덉슫???곹깭 ?ㅼ떆 ?뺤씤
      if (!isMounted.current) return;
      
      // ?깃났 ?????됱젏 諛??듦퀎 媛깆떊
      setMyRating(rating);
      await fetchMealRatingStats();

      // ?⑥씪 釉뚮씪?곗? ?명솚?? try-catch濡??대깽??諛쒖깮 ?섑븨
      try {
        // ?대깽??諛쒖깮?쒖폒 ?꾩껜 UI 媛깆떊
        const event = new CustomEvent('meal-rating-change', { 
          detail: { mealId, rating } 
        });
        window.dispatchEvent(event);
      } catch (eventError) {
        console.error('?대깽??諛쒖깮 以??ㅻ쪟:', eventError);
      }

    } catch (error) {
      console.error('湲됱떇 ?됱젏 ?쒖텧 ?ㅻ쪟:', error);
      if (isMounted.current) {
        // ?ㅻ쪟 ?곹깭 ?낅뜲?댄듃 (留덉슫?몃맂 寃쎌슦留?
        setIsLoading(false);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  // ?됱젏 ????⑥닔 (1~5留?upsert, 洹??몃뒗 臾댁“嫄???젣)
  const saveRating = async (rating: number | null) => {
    if (!mealId || !user) return false;

    try {
      setIsLoading(true);
      // rating??1~5媛 ?꾨땲硫?臾댁“嫄???젣
      if (rating === null || rating < 1 || rating > 5) {
        // CHECK ?쒖빟議곌굔: rating? 1~5留??덉슜
        console.log('湲됱떇 ?됱젏 row ??젣 ?쒕룄:', mealId, user.id);
        const { error } = await supabase
          .from('meal_ratings')
          .delete()
          .eq('user_id', user.id)
          .eq('meal_id', mealId);
        if (error) {
          console.error('?됱젏 row ??젣 ?ㅻ쪟:', error.message);
          return false;
        }
        console.log('?됱젏 row ??젣 ?깃났!');
        await fetchMealRatingStats();
        return true;
      } else {
        // rating??1~5??寃쎌슦?먮쭔 upsert
        console.log('湲됱떇 ?됱젏 ????쒖옉:', mealId, user.id, rating);
        await submitRating(rating);
        return true;
      }
    } catch (error) {
      console.error('?됱젏 ?????젣 以??ㅻ쪟 諛쒖깮:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };


  // 硫붾돱 ?꾩씠???됱젏 ????⑥닔
  const saveMenuItemRating = async (menuItemId: string, rating: number) => {
    if (!user) return false;

    try {
      console.log('硫붾돱 ?꾩씠???됱젏 ????쒖옉:', menuItemId, user.id, rating);
      
      // menu_item_ratings ?뚯씠釉붿뿉 ?됱젏 ???(upsert)
      const { error } = await supabase
        .from('menu_item_ratings')
        .upsert({
          user_id: user.id,
          menu_item_id: menuItemId,
          rating: rating,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,menu_item_id'
        });

      if (error) {
        console.error('硫붾돱 ?꾩씠???됱젏 ????ㅻ쪟:', error.message);
        return false;
      }

      console.log('硫붾돱 ?꾩씠???됱젏 ????깃났!');
      return true;
    } catch (error) {
      console.error('硫붾돱 ?꾩씠???됱젏 ???以??ㅻ쪟 諛쒖깮:', error);
      return false;
    }
  };


  // ?대깽??由ъ뒪???깅줉 諛??쒓굅
  useEffect(() => {
    // ?대깽??由ъ뒪???깅줉
    window.addEventListener('menu-item-rating-change', handleMenuItemRatingChange as EventListener);
    window.addEventListener('focus', handleFocus);

    // 而댄룷?뚰듃 ?몃쭏?댄듃 ???대깽??由ъ뒪???쒓굅 諛???대㉧ ?뺣━
    return () => {
      // 留덉슫???곹깭 ?낅뜲?댄듃
      isMounted.current = false;
      
      // ?대깽??由ъ뒪???쒓굅
      window.removeEventListener('menu-item-rating-change', handleMenuItemRatingChange as EventListener);
      window.removeEventListener('focus', handleFocus);
      
      // ??대㉧ ?뺣━
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [mealId, user]);
      
      // ?댁쟾 ??대㉧ ?뺣━
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      
      // 2. 諛깃렇?쇱슫?쒖뿉???ㅼ젣 ?곗씠??怨꾩궛 諛????泥섎━
      // ?쎄컙??吏?????좎? ?쒓컖??諛⑺빐 ?놁씠 怨꾩궛
      timerRef.current = window.setTimeout(async () => {
        try {
          // 而댄룷?뚰듃媛 ?ъ쟾??留덉슫?몃맂 ?곹깭?몄? ?뺤씤
          if (!isMounted.current) {
            console.log('??대㉧ 肄쒕갚: 而댄룷?뚰듃媛 ?몃쭏?댄듃?? ?묒뾽 痍⑥냼');
            return;
          }
          
          await calculateAndSaveMealRating(); // ?ㅼ젣 怨꾩궛 諛?DB ???          
          // 而댄룷?뚰듃媛 ?ъ쟾??留덉슫?몃맂 ?곹깭?몄? ?ㅼ떆 ?뺤씤
          if (!isMounted.current) return;
          
          // 3. UI ?낅뜲?댄듃瑜??꾪빐 ?뺥솗???곗씠???ъ“??          await fetchMyRating(); // ??蹂꾩젏 議고쉶
          await fetchMealRatingStats(); // ?꾩껜 ?됱젏 ?듦퀎 議고쉶
        } catch (error) {
          console.error('蹂꾩젏 ?낅뜲?댄듃 以??ㅻ쪟:', error);
          // ?ㅻ쪟媛 諛쒖깮?대룄 ??대㉧ 李몄“ ?뺣━
          timerRef.current = null;
        }
      }, 300) as any;
    }

  // 硫붾돱 ?꾩씠???됱젏 蹂寃??대깽??泥섎━ ?⑥닔
  const handleMenuItemRatingChange = (event: Event) => {
    // ????덉쟾???꾪븳 而ㅼ뒪? ?대깽?????媛??    if (!('detail' in event) || !event.detail) return;
    
    const detail = event.detail as { menuItemId?: string; newRating?: number; deleted?: boolean };
    if (!detail.menuItemId) return;
    
    // 留덉슫???곹깭 ?뺤씤 - ?몃쭏?댄듃 ??泥섎━ 諛⑹?
    if (!isMounted.current) {
      console.log('?몃쭏?댄듃??而댄룷?뚰듃???대깽??泥섎━ 臾댁떆');
      return;
    }
    
    console.log('硫붾돱 ?꾩씠???됱젏 蹂寃?媛먯?:', detail);
    
    // 1. UI 利됱떆 諛섏쓳???꾪븳 ?꾩떆 泥섎━
    if (detail.deleted && myRating) {
      // ??젣 泥섎━??寃쎌슦 - ?꾩옱 紐⑤뱺 蹂꾩젏????젣?섎㈃ myRating??null 泥섎━
      if (menuItemRatings.length <= 1) {
        setMyRating(null);
      }
    } else if (detail.newRating && !myRating) {
      // 泥섏쓬 蹂꾩젏??二쇰뒗 寃쎌슦 - ?꾩떆濡?媛??쒖떆
      setMyRating(detail.newRating);
    } else if (detail.newRating && myRating) {
      // 湲곗〈 蹂꾩젏 蹂寃?- ?꾩떆 怨꾩궛
      const tempRating = detail.newRating;
      setMyRating(tempRating);
    }
    
    // ?댁쟾 ??대㉧ ?뺣━
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // 2. 諛깃렇?쇱슫?쒖뿉???ㅼ젣 ?곗씠??怨꾩궛 諛????泥섎━
    // ?쎄컙??吏?????좎? ?쒓컖??諛⑺빐 ?놁씠 怨꾩궛
    timerRef.current = window.setTimeout(async () => {
      try {
        // 而댄룷?뚰듃媛 ?ъ쟾??留덉슫?몃맂 ?곹깭?몄? ?뺤씤
        if (!isMounted.current) {
          console.log('??대㉧ 肄쒕갚: 而댄룷?뚰듃媛 ?몃쭏?댄듃?? ?묒뾽 痍⑥냼');
          return;
        }
        
        await calculateAndSaveMealRating(); // ?ㅼ젣 怨꾩궛 諛?DB ???        
        // 而댄룷?뚰듃媛 ?ъ쟾??留덉슫?몃맂 ?곹깭?몄? ?ㅼ떆 ?뺤씤
        if (!isMounted.current) return;
        
        // 3. UI ?낅뜲?댄듃瑜??꾪빐 ?뺥솗???곗씠???ъ“??        await fetchMyRating(); // ??蹂꾩젏 議고쉶
        await fetchMealRatingStats(); // ?꾩껜 ?됱젏 ?듦퀎 議고쉶
      } catch (error) {
        console.error('蹂꾩젏 ?낅뜲?댄듃 以??ㅻ쪟:', error);
        // ?ㅻ쪟媛 諛쒖깮?대룄 ??대㉧ 李몄“ ?뺣━
        timerRef.current = null;
      }
    }, 300) as any;
  };

  // ?ъ빱?ㅻ? 媛吏??뚮쭏???ъ“?뚰븯??理쒖떊 ?곗씠??蹂댁옣
  const handleFocus = () => {
    // 而댄룷?뚰듃媛 留덉슫?몃맂 ?곹깭???뚮쭔 泥섎━
    if (!isMounted.current) return;
    
    if (user && mealId) {
      fetchMyRating();
      fetchMealRatingStats();
    }
  };

  // ?섏〈??諛곗뿴???대? useEffect 諛붾줈 ?꾩뿉 ?뺤쓽?섏뼱 ?덉쑝誘濡???젣

  // 珥덇린 ?곗씠??濡쒕뵫 ?⑥닔
  const fetchInitialData = async () => {
    try {
      await fetchMealRatingStats();
      if (user) {
        await fetchMyRating();
      }
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        console.log('?붿껌??痍⑥냼??);
      } else {
        console.error('珥덇린 ?곗씠??濡쒕뵫 以??ㅻ쪟:', error);
      }
    }
  };
  
  // 而댄룷?뚰듃 留덉슫???쒖? mealId, user 蹂寃????됱젏 議고쉶
  useEffect(() => {
    // 珥덇린???쒖뿉 留덉슫???곹깭瑜?true濡??ㅼ젙
    isMounted.current = true;
    
    // AbortController ?앹꽦
    const abortController = new AbortController();
    
    // 珥덇린 ?곗씠??濡쒕뵫
    fetchInitialData();
    
    // ?뺣━ ?⑥닔
    return () => {
      abortController.abort();
      isMounted.current = false;
    };
  }, [mealId, user]);

  // 별점 변경 핸들러 - 별점 클릭 시 호출됨
  const handleRatingChange = (value: number) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!isMounted.current) return;

    setMyRating(value);
    saveRating(value);
  };

  // 濡쒕뵫 以묒뿉??硫붿떆吏????긽 ?쒖떆
  if (isLoading) {
    return (
      <div className="my-4">
        <div className="text-lg font-medium">
          ?ㅻ뒛 ?섏쓽 ?됯???
        </div>
        <div className="mt-1 flex items-center">
          <div className="opacity-50">
            <StarRating value={0} onChange={() => {}} interactive={false} showValue={false} size="large" />
          </div>
          <span className="ml-2 text-sm text-gray-400">濡쒕뵫 以?..</span>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4">
      <div className="text-lg font-medium">
        ?ㅻ뒛 ?섏쓽 ?됯???
        {/* 濡쒓렇??+ 蹂꾩젏 ?낅젰???좎?留??됱젏 ?쒖떆, 0?먮룄 ?쒖떆 */}
        {user && myRating !== null && (
          <span className="ml-1">({myRating.toFixed(1)})</span>
        )}
      </div>
      <div className="mt-2">
        {/* 蹂꾩젏 ?낅젰 而댄룷?뚰듃 */}
        <StarRating 
          value={myRating || 0}
          onChange={handleRatingChange}
          interactive={!!user}
          showValue={false}
          size="large"
        />
        {!user && <span className="ml-2 text-sm text-gray-500">蹂꾩젏???④린?ㅻ㈃ 濡쒓렇?명븯?몄슂</span>}
      </div>
      {/* ?됯퇏 ?쒖떆 - ?ㅻ쪟 諛⑹?瑜??꾪빐 avgRating??議댁옱?섎뒗 寃쎌슦?먮쭔 ?쒖떆 */}
      {avgRating !== null && (
        <div className="mt-2 text-sm text-gray-600">
          ?됯퇏 ?됱젏: {avgRating.toFixed(1)}
        </div>
      )}
    </div>
  );
};

export default MyMealRating;
