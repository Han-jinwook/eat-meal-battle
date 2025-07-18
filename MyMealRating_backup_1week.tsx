// [MEMO] ?뚯뒪?몄슜 硫붾え: 2025-06-23, Cascade ?섏젙
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';

// Supabase ?대씪?댁뼵??珥덇린??const supabase = createClient();

interface MyMealRatingProps {
  mealId: string;
}

/**
 * 湲됱떇 ?꾩껜?????媛쒖씤 ?됱젏???쒖떆?섎뒗 而댄룷?뚰듃 (蹂꾩젏 UI ?놁씠 ?됱젏留??쒖떆)
 * ?됱젏? "(4.2)" ?뺤떇?쇰줈 ?쒖떆?? */
const MyMealRating: React.FC<MyMealRatingProps> = ({ mealId }) => {
  const [user, setUser] = useState<any>(null);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 而댄룷?뚰듃 留덉슫???곹깭 異붿쟻
  const isMounted = useRef<boolean>(true);

  // ?ъ슜???뺣낫 媛?몄삤湲?  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (isMounted.current) {
        setUser(data?.user);
      }
    };
    getUser();

    // 而댄룷?뚰듃 ?몃쭏?댄듃 ??cleanup
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ???됱젏 議고쉶 ?⑥닔
  const fetchMyRating = async () => {

    if (!mealId || !user) return;
    
    try {
      setIsLoading(true);
      
      // meal_ratings ?뚯씠釉붿뿉???ъ슜?먯쓽 湲됱떇 ?됱젏 議고쉶
      const { data, error } = await supabase
        .from('meal_ratings')
        .select('rating')
        .eq('meal_id', mealId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      // 而댄룷?뚰듃媛 ?몃쭏?댄듃??寃쎌슦 ?곹깭 ?낅뜲?댄듃 以묐떒
      if (!isMounted.current) return;
      
      if (error && error.code !== 'PGRST116') { // 寃곌낵 ?놁쓬 ?먮윭??臾댁떆
        console.error('??湲됱떇 ?됱젏 議고쉶 ?ㅻ쪟:', error.message);
        return;
      }
      
      if (data) {
        setMyRating(data.rating);
      } else {
        setMyRating(null);
      }
    } catch (error) {
      console.error('??湲됱떇 ?됱젏 議고쉶 以??ㅻ쪟 諛쒖깮:', error);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  // ?곗씠??濡쒕뱶
  useEffect(() => {

    if (!user || !mealId) return;
    fetchMyRating();
  }, [user, mealId]);

  // menu_item_ratings, menu_item_rating_stats, meal_rating_stats 以??섎굹??蹂寃쎌씠 諛쒖깮???????됱젏???ш퀎?????  useEffect(() => {
    if (!mealId || !user) return;
    // ?щ윭 ?뚯씠釉붿뿉 ????ㅼ떆媛?援щ룆???ㅼ젙
    const tables = [
      { table: 'menu_item_ratings', filter: '' },
      { table: 'menu_item_rating_stats', filter: '' },
      { table: 'meal_rating_stats', filter: `meal_id=eq.${mealId}` },
    ];
    const channels = tables.map(({ table, filter }) =>
      supabase
        .channel(`${table}:${mealId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        }, async () => {
          // 硫붾돱蹂?蹂꾩젏??諛붾뚮㈃ ??湲됱떇 ?됱젏???ш퀎?고빐??meal_ratings??upsert
          await recalculateAndSaveMyMealRating();
          // 洹몃━怨?UI??諛섏쁺
          fetchMyRating();
        })
        .subscribe()
    );
    // ?몃쭏?댄듃 ??援щ룆 ?댁젣
    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [mealId, user]);

  // meal_rating_stats ?ㅼ떆媛?援щ룆 異붽? (湲됱떇蹂??됱젏 蹂寃????먮룞 媛깆떊)
  useEffect(() => {
    if (!mealId) return;
    // Supabase ?ㅼ떆媛?援щ룆 梨꾨꼸 ?앹꽦
    const channel = supabase
      .channel(`meal_rating_stats:${mealId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'meal_rating_stats',
        filter: `meal_id=eq.${mealId}`
      }, (payload) => {

        // ?됱젏 蹂寃???fetchMyRating ?몄텧
        fetchMyRating();
      })
      .subscribe();
    // ?몃쭏?댄듃 ??援щ룆 ?댁젣
    return () => {
      supabase.removeChannel(channel);
    };
  }, [mealId]);

  // 硫붾돱蹂?蹂꾩젏 湲곕컲?쇰줈 ??湲됱떇 ?됱젏???ш퀎?고븯??meal_ratings?????  const recalculateAndSaveMyMealRating = async () => {
    // menu_item_ratings?먯꽌 ??蹂꾩젏留?紐⑥븘???됯퇏 怨꾩궛
    const { data: ratings, error } = await supabase
      .from('menu_item_ratings')
      .select('rating')
      .eq('user_id', user.id)
      .eq('meal_id', mealId);
    if (error || !ratings || ratings.length === 0) return;
    const avg = ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length;
    // meal_ratings??upsert
    await supabase.from('meal_ratings').upsert({
      meal_id: mealId,
      user_id: user.id,
      rating: avg,
    });
  };

  // 濡쒕뵫 ?곹깭????  if (isLoading) {
    return (
      <div className="my-4">
        <div className="text-lg font-medium">
          ?ㅻ뒛 ?섏쓽 ?됯???
        </div>
      </div>
    );
  }

  return (
    <div className="my-4">
      <div className="text-lg font-medium">
        ?ㅻ뒛 ?섏쓽 ?됯???
        {/* 濡쒓렇??+ ?됱젏 ?덈뒗 ?좎?留??됱젏 ?쒖떆 */}
        {user && myRating !== null && (
          <span className="ml-1">({myRating.toFixed(1)})</span>
        )}
      </div>
    </div>
  );
};

export default MyMealRating;
